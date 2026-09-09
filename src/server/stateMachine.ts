import { randomUUID } from 'node:crypto';
import { CheckoutSession } from './types/checkout-session';
import { Listing } from './services/inventoryService';

// Shared by applyResumeTransition below and the direct price recheck inside
// POST /complete (app.ts), so the "what counts as an unacknowledged price
// change" condition only lives in one place.
export function hasUnacknowledgedPriceChange(session: CheckoutSession, listing: Listing): boolean {
    return listing.price !== session.priceAtHold && !session.priceChangeAcknowledged;
}

export function applyResumeTransition(session: CheckoutSession, listing: Listing, now: Date): CheckoutSession {
    // payment_pending/completed/completion_failed are one-time event outcomes
    // with no standing condition to re-derive from (unlike price_changed or
    // expired, which stay correct across repeated resumes because the
    // underlying price/inventory/TTL check is re-evaluated fresh each time).
    // Without this guard, reloading the page after a failed payment would
    // silently erase completion_failed back to active before the fan ever
    // saw it — the fan must take an explicit retry action instead.
    if (
        session.status === 'payment_pending' ||
        session.status === 'completed' ||
        session.status === 'completion_failed'
    ) {
        return session;
    }

    session.currentPrice = listing.price;

    if (new Date(session.expiresAt) <= now) {
        session.status = 'expired';
        session.expiredReason = 'ttl';
    } else if (listing.availableQty <= 0) {
        session.status = 'expired';
        session.expiredReason = 'inventory';
    } else if (hasUnacknowledgedPriceChange(session, listing)) {
        session.status = 'price_changed';
    } else {
        session.status = 'active';
    }

    return session;
}

// Assumes the caller has already verified session.status === 'price_changed';
// the 409-if-not-price_changed check is an HTTP concern that lives in the route handler.
export function applyAcknowledgePrice(session: CheckoutSession): CheckoutSession {
    session.priceAtHold = session.currentPrice;
    session.priceChangeAcknowledged = true;
    session.status = 'active';

    return session;
}

// Assumes the caller has already verified session.status is 'active' or
// 'completion_failed' (the 409-if-otherwise checks are an HTTP concern that
// live in the route handler, same as applyAcknowledgePrice above).
//
// The status flip to 'payment_pending' below is the actual duplicate-order
// lock. It's the very first thing this function does, synchronously, before
// the "await attemptPayment()" line — Node runs everything up to that await
// in one uninterrupted turn, so a second /complete call arriving even a
// microtask later will always see 'payment_pending' already set. Moving the
// flip to *after* the await would silently reopen the exact race window
// this function exists to close.
export async function completeSession(
    session: CheckoutSession,
    attemptPayment: () => Promise<boolean>,
): Promise<CheckoutSession> {
    session.status = 'payment_pending';

    const succeeded = await attemptPayment();

    if (succeeded) {
        session.status = 'completed';
        session.orderId = randomUUID();
        session.completedOnSurface = session.lastResumedSurface;
    } else {
        session.status = 'completion_failed';
    }

    return session;
}
