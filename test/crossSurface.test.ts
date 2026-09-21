import { api } from './routeHandler';
import MobileCheckoutPage from '../app/mobile/checkout/[id]/page';
import { setListingPrice, resetListing } from '../src/server/services/inventoryService';
import { signResumeToken } from '../src/server/resumeToken';

const LISTING_ID = 'lakers-warriors-112-14';

// The deep-link page is a Server Component: an async function that returns
// the page's element tree, or throws the framework's not-found signal.
// Calling it directly exercises the real token gate and the real resume,
// without rendering — the side effects on the session are what these tests
// are about.
function openMobileDeepLink(sessionId: string, token?: string) {
    return MobileCheckoutPage({
        params: Promise.resolve({ id: sessionId }),
        searchParams: Promise.resolve({ token }),
    });
}

afterEach(() => {
    resetListing(LISTING_ID);
});

describe('full cross-surface run-through', () => {
    test('create on web, resume on mobile, force a price change, acknowledge, and complete', async () => {
        // 1. Create on web
        const createRes = await api.createSession({ listingId: LISTING_ID, qty: 2 });
        expect(createRes.status).toBe(201);
        const sessionId = createRes.body.session.id;
        expect(createRes.body.session.status).toBe('active');
        // The real deep link a buyer would actually be sent requires this token
        // now that /mobile/checkout/:id enforces it — same as createRes would
        // have returned via resumeToken, generated directly here for clarity.
        const token = signResumeToken(sessionId);

        // 2. Resume on mobile — the actual deep-link page route, not just the JSON API
        await expect(openMobileDeepLink(sessionId, token)).resolves.toBeTruthy();

        let sessionState = (await api.getSession(sessionId)).body.session;
        expect(sessionState.lastResumedSurface).toBe('mobile');
        expect(sessionState.status).toBe('active'); // nothing wrong yet

        // 3. Price changes on the backend while the buyer is on the mobile page
        setListingPrice(LISTING_ID, 199);

        // 4. Resuming again on mobile is what actually detects the change
        await expect(openMobileDeepLink(sessionId, token)).resolves.toBeTruthy();

        sessionState = (await api.getSession(sessionId)).body.session;
        expect(sessionState.status).toBe('price_changed');
        expect(sessionState.currentPrice).toBe(199);
        expect(sessionState.priceAtHold).toBe(145); // unchanged until acknowledged

        // Completion is blocked until the buyer explicitly accepts the new price
        const blockedComplete = await api.complete(sessionId, { idempotencyKey: 'attempt-1' });
        expect(blockedComplete.status).toBe(409);
        expect(blockedComplete.body.code).toBe('PRICE_CHANGE_UNACKED');

        // 5. Buyer explicitly accepts the new price (on mobile)
        const ackRes = await api.acknowledgePrice(sessionId);
        expect(ackRes.status).toBe(200);
        expect(ackRes.body.session.status).toBe('active');
        expect(ackRes.body.session.priceAtHold).toBe(199);

        // 6. Complete the purchase
        const completeRes = await api.complete(sessionId, { idempotencyKey: 'attempt-2' });
        expect(completeRes.status).toBe(200);
        expect(completeRes.body.session.status).toBe('completed');
        expect(completeRes.body.session.orderId).toBeDefined();
        // Reflects the surface that actually drove the flow, proving this
        // wasn't just a web-only happy path with a mobile page loaded for show.
        expect(completeRes.body.session.completedOnSurface).toBe('mobile');
    });
});

describe('mobile deep-link token gate', () => {
    const NOT_FOUND = { digest: 'NEXT_HTTP_ERROR_FALLBACK;404' };

    test('a missing token is treated as not found, and does not resume the session', async () => {
        const { body } = await api.createSession({ listingId: LISTING_ID, qty: 2 });

        await expect(openMobileDeepLink(body.session.id)).rejects.toMatchObject(NOT_FOUND);

        const after = (await api.getSession(body.session.id)).body.session;
        expect(after.lastResumedSurface).toBeUndefined();
    });

    test('a forged token is treated as not found, indistinguishable from an unknown session', async () => {
        const { body } = await api.createSession({ listingId: LISTING_ID, qty: 2 });

        // Same signal for "real session, bad token" and "no such session" —
        // a bare leaked session id must not confirm that the session exists.
        await expect(openMobileDeepLink(body.session.id, 'forged.0.deadbeef')).rejects.toMatchObject(NOT_FOUND);
        await expect(openMobileDeepLink('no-such-session', 'forged.0.deadbeef')).rejects.toMatchObject(NOT_FOUND);
    });
});
