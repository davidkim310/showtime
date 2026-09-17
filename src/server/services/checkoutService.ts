import { randomUUID } from 'node:crypto';
import { CheckoutSession, CheckoutSurface } from '../types/checkout-session';
import { getListing } from './inventoryService';
import { attemptPayment } from './paymentService';
import { addPaymentMethod } from './paymentMethodsService';
import { getSession, saveSession } from './sessionStore';
import {
    applyResumeTransition,
    applyAcknowledgePrice,
    completeSession,
    hasUnacknowledgedPriceChange,
} from '../stateMachine';
import { logEvent } from '../instrumentation';
import { createSessionSchema, addPaymentMethodSchema } from '../schemas';
import { signResumeToken } from '../resumeToken';

// Every operation returns the status and body the transport should send, so
// Express routes and Next.js Route Handlers stay mechanical translations of
// the same decisions rather than two copies of the rules.
export type ServiceResult<T> = { status: number; body: T };

type ErrorBody = { error: string; code: string; session?: CheckoutSession };

const SESSION_NOT_FOUND: ServiceResult<ErrorBody> = {
    status: 404,
    body: { error: 'Session not found', code: 'SESSION_NOT_FOUND' },
};

// 10 minutes, a typical ticket-hold window. Read fresh (not cached at
// module load) so tests can override it via SESSION_TTL_MS to exercise
// expiration without waiting 10 real minutes — a top-level constant would
// read process.env before a test ever gets a chance to set it, since
// TypeScript hoists imports above other module-level code.
function getSessionTtlMs(): number {
    return Number(process.env.SESSION_TTL_MS) || 10 * 60 * 1000;
}

// Per the design spec, loading/reloading the web checkout page IS a resume
// action ("A user can resume the same session from: Web route... Reloaded
// browser tab"), so the page render and the JSON /resume route share this.
export function resumeSession(session: CheckoutSession, surface: CheckoutSurface): void {
    // Guaranteed to exist: sessions are only ever created from a catalog
    // lookup, and nothing in this stub ever removes a catalog entry.
    const listing = getListing(session.listingId)!;

    applyResumeTransition(session, listing, new Date());
    session.lastResumedSurface = surface;
    session.version += 1;

    logEvent('session_resumed', { sessionId: session.id, surface, status: session.status });

    // Treating "resumed into this status" as "shown" here rather than
    // duplicating this check in both page routes — every resume in this stub
    // is immediately followed by a render, so the two are equivalent for our
    // purposes even though they wouldn't necessarily be in a real app (a
    // background resume poll wouldn't always mean a fan is looking at a screen).
    if (session.status === 'price_changed') {
        logEvent('price_changed_shown', { sessionId: session.id, surface });
    } else if (session.status === 'expired') {
        logEvent('expired_shown', { sessionId: session.id, surface, reason: session.expiredReason });
    }
}

export function createCheckoutSession(
    input: unknown,
): ServiceResult<{ session: CheckoutSession; resumeToken: string } | ErrorBody> {
    const parsed = createSessionSchema.safeParse(input);
    if (!parsed.success) {
        return { status: 400, body: { error: 'Invalid input', code: 'INVALID_INPUT' } };
    }
    const { listingId, qty } = parsed.data;

    const listing = getListing(listingId);
    if (!listing) {
        return { status: 404, body: { error: 'Listing not found', code: 'LISTING_NOT_FOUND' } };
    }
    if (listing.availableQty <= 0) {
        return { status: 409, body: { error: 'Listing is sold out', code: 'LISTING_SOLD_OUT' } };
    }

    const now = new Date();
    const session: CheckoutSession = {
        id: randomUUID(),
        listingId,
        event: listing.event,
        listing: {
            section: listing.section,
            row: listing.row,
            qty,
            deliveryMethod: 'mobile_transfer',
        },
        priceAtHold: listing.price,
        currentPrice: listing.price,
        priceChangeAcknowledged: false,
        status: 'active',
        createdAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + getSessionTtlMs()).toISOString(),
        version: 1,
    };

    saveSession(session);
    logEvent('session_created', { sessionId: session.id, listingId, qty });

    return { status: 201, body: { session, resumeToken: signResumeToken(session.id) } };
}

export function fetchCheckoutSession(id: string): ServiceResult<{ session: CheckoutSession } | ErrorBody> {
    const session = getSession(id);
    if (!session) return SESSION_NOT_FOUND;

    return { status: 200, body: { session } };
}

export function resumeCheckoutSession(
    id: string,
    surface: CheckoutSurface,
): ServiceResult<{ session: CheckoutSession } | ErrorBody> {
    const session = getSession(id);
    if (!session) return SESSION_NOT_FOUND;

    resumeSession(session, surface);

    return { status: 200, body: { session } };
}

export function acknowledgePrice(id: string): ServiceResult<{ session: CheckoutSession } | ErrorBody> {
    const session = getSession(id);
    if (!session) return SESSION_NOT_FOUND;

    if (session.status !== 'price_changed') {
        return {
            status: 409,
            body: { error: 'Nothing to acknowledge', code: 'NOTHING_TO_ACKNOWLEDGE', session },
        };
    }

    applyAcknowledgePrice(session);
    session.version += 1;

    return { status: 200, body: { session } };
}

export async function completeCheckout(
    id: string,
    input: { idempotencyKey?: string; paymentMethodId?: string },
): Promise<ServiceResult<{ session: CheckoutSession } | ErrorBody>> {
    const session = getSession(id);
    if (!session) return SESSION_NOT_FOUND;

    // Idempotent no-op: a late/duplicate completion call from a second
    // surface after the first already succeeded gets the existing order
    // back, not an error and never a second order.
    if (session.status === 'completed') {
        return { status: 200, body: { session } };
    }

    if (session.status === 'payment_pending') {
        logEvent('duplicate_prevented', { sessionId: session.id });
        return {
            status: 409,
            body: {
                error: 'This is already being completed on another device',
                code: 'COMPLETION_IN_PROGRESS',
                session,
            },
        };
    }

    // Rechecked directly against the clock, not just the cached status —
    // a session can be past expiresAt without ever having been re-resumed
    // since then, and expiration must be enforced server-side regardless of
    // whether a client happened to poll/resume recently.
    if (session.status === 'expired' || new Date(session.expiresAt) <= new Date()) {
        session.status = 'expired';
        session.expiredReason = session.expiredReason ?? 'ttl';
        return { status: 409, body: { error: 'Session has expired', code: 'SESSION_EXPIRED', session } };
    }

    if (session.status === 'price_changed') {
        return {
            status: 409,
            body: {
                error: 'Price change must be acknowledged before completing',
                code: 'PRICE_CHANGE_UNACKED',
                session,
            },
        };
    }

    // Rechecked directly against the live listing, symmetric with the TTL
    // recheck above — a cached 'active' status only means nothing was wrong
    // as of the last resume, not that nothing has changed since. Without
    // this, a price change landing after a fan's last resume but before a
    // completion attempt would go undetected and charge the stale price.
    const currentListing = getListing(session.listingId)!;
    session.currentPrice = currentListing.price;
    if (hasUnacknowledgedPriceChange(session, currentListing)) {
        session.status = 'price_changed';
        session.version += 1;
        return {
            status: 409,
            body: {
                error: 'Price change must be acknowledged before completing',
                code: 'PRICE_CHANGE_UNACKED',
                session,
            },
        };
    }

    // Only 'active' or 'completion_failed' (retry) reach here.
    session.idempotencyKey = input.idempotencyKey;
    session.paymentMethodId = input.paymentMethodId;
    logEvent('completion_attempted', { sessionId: session.id, surface: session.lastResumedSurface });
    const completedSession = await completeSession(session, attemptPayment);
    session.version += 1;

    if (completedSession.status === 'completed') {
        logEvent('completion_succeeded', { sessionId: session.id, orderId: completedSession.orderId });
    } else {
        logEvent('completion_failed', { sessionId: session.id });
    }

    return { status: 200, body: { session } };
}

export function addSessionPaymentMethod(id: string, input: unknown): ServiceResult<unknown> {
    const session = getSession(id);
    if (!session) return SESSION_NOT_FOUND;

    const parsed = addPaymentMethodSchema.safeParse(input);
    if (!parsed.success) {
        return { status: 400, body: { error: 'Invalid input', code: 'INVALID_INPUT' } };
    }

    const paymentMethod = addPaymentMethod(parsed.data);
    logEvent('payment_method_added', { paymentMethodId: paymentMethod.id, brand: paymentMethod.brand });

    return { status: 201, body: { paymentMethod } };
}
