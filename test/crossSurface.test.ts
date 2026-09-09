import request from 'supertest';
import app from '../src/server/app';
import { setListingPrice, resetListing } from '../src/server/services/inventoryService';
import { signResumeToken } from '../src/server/resumeToken';

const LISTING_ID = 'lakers-warriors-112-14';

afterEach(() => {
    resetListing(LISTING_ID);
});

describe('full cross-surface run-through', () => {
    test('create on web, resume on mobile, force a price change, acknowledge, and complete', async () => {
        // 1. Create on web
        const createRes = await request(app).post('/checkout-sessions').send({ listingId: LISTING_ID, qty: 2 });
        expect(createRes.status).toBe(201);
        const sessionId = createRes.body.session.id;
        expect(createRes.body.session.status).toBe('active');
        // The real deep link a fan would actually be sent requires this token
        // now that /mobile/checkout/:id enforces it — same as createRes would
        // have returned via resumeToken, generated directly here for clarity.
        const token = signResumeToken(sessionId);

        // 2. Resume on mobile — the actual deep-link page route, not just the JSON API
        const mobileRes1 = await request(app).get(`/mobile/checkout/${sessionId}?token=${token}`);
        expect(mobileRes1.status).toBe(200);

        let sessionState = (await request(app).get(`/checkout-sessions/${sessionId}`)).body.session;
        expect(sessionState.lastResumedSurface).toBe('mobile');
        expect(sessionState.status).toBe('active'); // nothing wrong yet

        // 3. Price changes on the backend while the fan is on the mobile page
        setListingPrice(LISTING_ID, 199);

        // 4. Resuming again on mobile is what actually detects the change
        const mobileRes2 = await request(app).get(`/mobile/checkout/${sessionId}?token=${token}`);
        expect(mobileRes2.status).toBe(200);

        sessionState = (await request(app).get(`/checkout-sessions/${sessionId}`)).body.session;
        expect(sessionState.status).toBe('price_changed');
        expect(sessionState.currentPrice).toBe(199);
        expect(sessionState.priceAtHold).toBe(145); // unchanged until acknowledged

        // Completion is blocked until the fan explicitly accepts the new price
        const blockedComplete = await request(app)
            .post(`/checkout-sessions/${sessionId}/complete`)
            .send({ idempotencyKey: 'attempt-1' });
        expect(blockedComplete.status).toBe(409);
        expect(blockedComplete.body.code).toBe('PRICE_CHANGE_UNACKED');

        // 5. Fan explicitly accepts the new price (on mobile)
        const ackRes = await request(app).post(`/checkout-sessions/${sessionId}/acknowledge-price`);
        expect(ackRes.status).toBe(200);
        expect(ackRes.body.session.status).toBe('active');
        expect(ackRes.body.session.priceAtHold).toBe(199);

        // 6. Complete the purchase
        const completeRes = await request(app)
            .post(`/checkout-sessions/${sessionId}/complete`)
            .send({ idempotencyKey: 'attempt-2' });
        expect(completeRes.status).toBe(200);
        expect(completeRes.body.session.status).toBe('completed');
        expect(completeRes.body.session.orderId).toBeDefined();
        // Reflects the surface that actually drove the flow, proving this
        // wasn't just a web-only happy path with a mobile page loaded for show.
        expect(completeRes.body.session.completedOnSurface).toBe('mobile');
    });
});
