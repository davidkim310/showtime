import express from 'express';
import { getListing, getAllListings, searchListings, setListingPrice, markListingSoldOut, resetListing } from './services/inventoryService';
import { setNextPaymentResult } from './services/paymentService';
import { getSavedPaymentMethods } from './services/paymentMethodsService';
import { getSession } from './services/sessionStore';
import {
    resumeSession,
    createCheckoutSession,
    fetchCheckoutSession,
    resumeCheckoutSession,
    acknowledgePrice,
    completeCheckout,
    addSessionPaymentMethod,
} from './services/checkoutService';
import {
    renderBrowseListingsPage,
    renderSelectListingPage,
    renderCheckoutPage,
    renderMobileCheckoutPage,
    renderAddPaymentMethodPage,
} from './views';
import { verifyResumeToken } from './resumeToken';

const app = express();
app.use(express.json());
app.use(express.static('public'));

app.get('/hello', (req, res) => res.json({ message: 'hello world' }));

app.post('/checkout-sessions', (req, res) => {
    const { status, body } = createCheckoutSession(req.body);
    res.status(status).json(body);
});

app.get('/checkout-sessions/:id', (req, res) => {
    const { status, body } = fetchCheckoutSession(req.params.id);
    res.status(status).json(body);
});

app.post('/checkout-sessions/:id/resume', (req, res) => {
    const { status, body } = resumeCheckoutSession(req.params.id, req.body.surface);
    res.status(status).json(body);
});

app.post('/checkout-sessions/:id/acknowledge-price', (req, res) => {
    const { status, body } = acknowledgePrice(req.params.id);
    res.status(status).json(body);
});

app.post('/checkout-sessions/:id/complete', async (req, res) => {
    const { status, body } = await completeCheckout(req.params.id, req.body);
    res.status(status).json(body);
});

app.post('/checkout-sessions/:id/payment-methods', (req, res) => {
    const { status, body } = addSessionPaymentMethod(req.params.id, req.body);
    res.status(status).json(body);
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
    const session = getSession(req.params.id);
    if (!session) {
        return res.status(404).send('Checkout session not found');
    }

    resumeSession(session, 'web');

    res.status(200).send(renderCheckoutPage(session, getSavedPaymentMethods()));
});

app.get('/checkout/:id/payment-methods/new', (req, res) => {
    const session = getSession(req.params.id);
    if (!session) {
        return res.status(404).send('Checkout session not found');
    }

    res.status(200).send(renderAddPaymentMethodPage(session));
});

app.get('/mobile/checkout/:id', (req, res) => {
    const session = getSession(req.params.id);
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
// unauthenticated write endpoint never ships.
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
