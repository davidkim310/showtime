import express from 'express';
import { randomUUID } from 'node:crypto';
import { CheckoutSession, CheckoutSurface } from './types/checkout-session';
import { getListing, getAllListings, searchListings, setListingPrice, markListingSoldOut, resetListing } from './services/inventoryService';
import { attemptPayment, setNextPaymentResult } from './services/paymentService';
import { getSavedPaymentMethods, addPaymentMethod } from './services/paymentMethodsService';
import { applyResumeTransition, applyAcknowledgePrice, completeSession, hasUnacknowledgedPriceChange } from './stateMachine';
import {
    renderBrowseListingsPage,
    renderSelectListingPage,
    renderCheckoutPage,
    renderMobileCheckoutPage,
    renderAddPaymentMethodPage,
} from './views';
import { logEvent } from './instrumentation';
import { createSessionSchema, addPaymentMethodSchema } from './schemas';
import { signResumeToken, verifyResumeToken } from './resumeToken';

const sessions = new Map<string, CheckoutSession>();

// 10 minutes, a typical ticket-hold window. Read fresh (not cached at
// module load) so tests can override it via SESSION_TTL_MS to exercise
// expiration without waiting 10 real minutes — a top-level constant would
// read process.env before a test ever gets a chance to set it, since
// TypeScript hoists imports above other module-level code.
function getSessionTtlMs(): number {
    return Number(process.env.SESSION_TTL_MS) || 10 * 60 * 1000;
}

const app = express();
app.use(express.json());
app.use(express.static('public'));

// Shared by the JSON /resume route and the web checkout page route below —
// per the design spec, loading/reloading the web checkout page IS a resume
// action ("A user can resume the same session from: Web route... Reloaded
// browser tab"), so both paths need the exact same transition logic.
function resumeSession(session: CheckoutSession, surface: CheckoutSurface): void {
    // Guaranteed to exist: sessions are only ever created from a catalog
    // lookup, and nothing in this stub ever removes a catalog entry.
    const listing = getListing(session.listingId)!;

    applyResumeTransition(session, listing, new Date());
    session.lastResumedSurface = surface;
    session.version += 1;

    logEvent('session_resumed', { sessionId: session.id, surface, status: session.status });

    // Treating "resumed into this status" as "shown" here rather than
    // duplicating this check in both page routes below — every resume in
    // this stub is immediately followed by a render, so the two are
    // equivalent for our purposes even though they wouldn't necessarily be
    // in a real app (a background resume poll wouldn't always mean a fan
    // is looking at a screen).
    if (session.status === 'price_changed') {
        logEvent('price_changed_shown', { sessionId: session.id, surface });
    } else if (session.status === 'expired') {
        logEvent('expired_shown', { sessionId: session.id, surface, reason: session.expiredReason });
    }
}

app.get('/hello', (req, res) => res.json({ message: 'hello world' }));

app.post('/checkout-sessions', (req, res) => {
    const parsed = createSessionSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid input', code: 'INVALID_INPUT' });
    }
    const { listingId, qty } = parsed.data;

    const listing = getListing(listingId);
    if (!listing) {
        return res.status(404).json({ error: 'Listing not found', code: 'LISTING_NOT_FOUND' });
    }
    if (listing.availableQty <= 0) {
        return res.status(409).json({ error: 'Listing is sold out', code: 'LISTING_SOLD_OUT' });
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

    sessions.set(session.id, session);
    logEvent('session_created', { sessionId: session.id, listingId, qty });

    const resumeToken = signResumeToken(session.id);
    res.status(201).json({ session, resumeToken });
});

app.get('/checkout-sessions/:id', (req, res) => {
    const session = sessions.get(req.params.id);
    if (!session) {
        return res.status(404).json({ error: 'Session not found', code: 'SESSION_NOT_FOUND' });
    }

    res.status(200).json({ session });
});

app.post('/checkout-sessions/:id/resume', (req, res) => {
    const session = sessions.get(req.params.id);
    if (!session) {
        return res.status(404).json({ error: 'Session not found', code: 'SESSION_NOT_FOUND' });
    }

    resumeSession(session, req.body.surface);

    res.status(200).json({ session });
});

app.post('/checkout-sessions/:id/acknowledge-price', (req, res) => {
    const session = sessions.get(req.params.id);
    if (!session) {
        return res.status(404).json({ error: 'Session not found', code: 'SESSION_NOT_FOUND' });
    }

    if (session.status !== 'price_changed') {
        return res
            .status(409)
            .json({ error: 'Nothing to acknowledge', code: 'NOTHING_TO_ACKNOWLEDGE', session });
    }

    applyAcknowledgePrice(session);
    session.version += 1;

    res.status(200).json({ session });
});

app.post('/checkout-sessions/:id/complete', async (req, res) => {
    const session = sessions.get(req.params.id);
    if (!session) {
        return res.status(404).json({ error: 'Session not found', code: 'SESSION_NOT_FOUND' });
    }

    // Idempotent no-op: a late/duplicate completion call from a second
    // surface after the first already succeeded gets the existing order
    // back, not an error and never a second order.
    if (session.status === 'completed') {
        return res.status(200).json({ session });
    }

    if (session.status === 'payment_pending') {
        logEvent('duplicate_prevented', { sessionId: session.id });
        return res.status(409).json({
            error: 'This is already being completed on another device',
            code: 'COMPLETION_IN_PROGRESS',
            session,
        });
    }

    // Rechecked directly against the clock, not just the cached status —
    // a session can be past expiresAt without ever having been re-resumed
    // since then, and expiration must be enforced server-side regardless of
    // whether a client happened to poll/resume recently.
    if (session.status === 'expired' || new Date(session.expiresAt) <= new Date()) {
        session.status = 'expired';
        session.expiredReason = session.expiredReason ?? 'ttl';
        return res.status(409).json({ error: 'Session has expired', code: 'SESSION_EXPIRED', session });
    }

    if (session.status === 'price_changed') {
        return res.status(409).json({
            error: 'Price change must be acknowledged before completing',
            code: 'PRICE_CHANGE_UNACKED',
            session,
        });
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
        return res.status(409).json({
            error: 'Price change must be acknowledged before completing',
            code: 'PRICE_CHANGE_UNACKED',
            session,
        });
    }

    // Only 'active' or 'completion_failed' (retry) reach here.
    session.idempotencyKey = req.body.idempotencyKey;
    session.paymentMethodId = req.body.paymentMethodId;
    logEvent('completion_attempted', { sessionId: session.id, surface: session.lastResumedSurface });
    const completedSession = await completeSession(session, attemptPayment);
    session.version += 1;

    if (completedSession.status === 'completed') {
        logEvent('completion_succeeded', { sessionId: session.id, orderId: completedSession.orderId });
    } else {
        logEvent('completion_failed', { sessionId: session.id });
    }

    res.status(200).json({ session });
});

app.get('/', (req, res) => {
    res.status(200).send(renderBrowseListingsPage(getAllListings()));
});

// Registered before /listings/:id — Express matches routes in registration
// order, and the dynamic :id route would otherwise treat "search" as an id
// value and shadow this one entirely.
app.get('/listings/search', (req, res) => {
    const query = typeof req.query.q === 'string' ? req.query.q : '';
    res.status(200).json({ listings: searchListings(query) });
});

app.get('/listings/:id', (req, res) => {
    const listing = getListing(req.params.id);
    if (!listing) {
        return res.status(404).send('Listing not found');
    }

    res.status(200).send(renderSelectListingPage(listing));
});

app.get('/checkout/:id', (req, res) => {
    const session = sessions.get(req.params.id);
    if (!session) {
        return res.status(404).send('Checkout session not found');
    }

    resumeSession(session, 'web');

    res.status(200).send(renderCheckoutPage(session, getSavedPaymentMethods()));
});

app.get('/checkout/:id/payment-methods/new', (req, res) => {
    const session = sessions.get(req.params.id);
    if (!session) {
        return res.status(404).send('Checkout session not found');
    }

    res.status(200).send(renderAddPaymentMethodPage(session));
});

app.post('/checkout-sessions/:id/payment-methods', (req, res) => {
    const session = sessions.get(req.params.id);
    if (!session) {
        return res.status(404).json({ error: 'Session not found', code: 'SESSION_NOT_FOUND' });
    }

    const parsed = addPaymentMethodSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid input', code: 'INVALID_INPUT' });
    }

    const paymentMethod = addPaymentMethod(parsed.data);
    logEvent('payment_method_added', { paymentMethodId: paymentMethod.id, brand: paymentMethod.brand });

    res.status(201).json({ paymentMethod });
});

app.get('/mobile/checkout/:id', (req, res) => {
    const session = sessions.get(req.params.id);
    if (!session) {
        return res.status(404).send('Checkout session not found');
    }

    // Required, not optional: an attacker with a leaked bare session id has
    // no token at all, so an optional check (valid-if-present) would do
    // nothing against the actual threat this token exists to defend against.
    if (!verifyResumeToken(req.query.token as string | undefined, session.id)) {
        return res.status(403).send('Invalid or expired link');
    }

    resumeSession(session, 'mobile');

    res.status(200).send(renderMobileCheckoutPage(session));
});

// TEMPORARY, dev-only test scaffolding — not part of the graded API surface.
// Lets you manually trigger price-changed/sold-out scenarios by hand without
// waiting on the real TTL or writing a script. Gated out of production so an
// unauthenticated write endpoint never ships; remove before final submission
// once Day 8's full run-through no longer needs manual triggering.
if (process.env.NODE_ENV !== 'production') {
    app.post('/debug/listings/:id/price', (req, res) => {
        setListingPrice(req.params.id, req.body.price);
        res.status(200).json({ ok: true });
    });

    app.post('/debug/listings/:id/sold-out', (req, res) => {
        markListingSoldOut(req.params.id);
        res.status(200).json({ ok: true });
    });

    app.post('/debug/listings/:id/reset', (req, res) => {
        resetListing(req.params.id);
        res.status(200).json({ ok: true });
    });

    app.post('/debug/payment/force-result', (req, res) => {
        setNextPaymentResult(Boolean(req.body.succeeds));
        res.status(200).json({ ok: true });
    });
}

export default app;
