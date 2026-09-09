// Short TTL so the expiration test doesn't need to wait 10 real minutes —
// read fresh inside the route handler (see getSessionTtlMs in app.ts), so
// setting this before requests are made is all that's needed.
process.env.SESSION_TTL_MS = '50';

import request from 'supertest';
import app from '../src/server/app';
import { setListingPrice, resetListing } from '../src/server/services/inventoryService';
import { setNextPaymentResult, resetPaymentResult } from '../src/server/services/paymentService';

const LISTING_ID = 'lakers-warriors-112-14';

async function createSession(qty = 2) {
    const res = await request(app).post('/checkout-sessions').send({ listingId: LISTING_ID, qty });
    return res.body.session;
}

afterEach(() => {
    resetListing(LISTING_ID);
    resetPaymentResult();
});

describe('POST /checkout-sessions/:id/complete', () => {
    test('happy path: completes and sets an orderId', async () => {
        const session = await createSession();

        const res = await request(app)
            .post(`/checkout-sessions/${session.id}/complete`)
            .send({ idempotencyKey: 'key-1' });

        expect(res.status).toBe(200);
        expect(res.body.session.status).toBe('completed');
        expect(res.body.session.orderId).toBeDefined();
    });

    test('duplicate completion is idempotent: returns the same order, not an error', async () => {
        const session = await createSession();

        const first = await request(app)
            .post(`/checkout-sessions/${session.id}/complete`)
            .send({ idempotencyKey: 'key-1' });
        const second = await request(app)
            .post(`/checkout-sessions/${session.id}/complete`)
            .send({ idempotencyKey: 'key-2' });

        expect(second.status).toBe(200);
        expect(second.body.session.status).toBe('completed');
        expect(second.body.session.orderId).toBe(first.body.session.orderId);
    });

    test('rejects completion while a price change is unacknowledged', async () => {
        const session = await createSession();
        setListingPrice(LISTING_ID, 999);
        await request(app).post(`/checkout-sessions/${session.id}/resume`).send({ surface: 'web' });

        const res = await request(app)
            .post(`/checkout-sessions/${session.id}/complete`)
            .send({ idempotencyKey: 'key-1' });

        expect(res.status).toBe(409);
        expect(res.body.code).toBe('PRICE_CHANGE_UNACKED');
    });

    test('rejects completion when price changed since the last resume, even without a resume in between', async () => {
        const session = await createSession();
        await request(app).post(`/checkout-sessions/${session.id}/resume`).send({ surface: 'web' });
        // Price changes on the backend, but the fan never resumes again before completing.
        setListingPrice(LISTING_ID, 999);

        const res = await request(app)
            .post(`/checkout-sessions/${session.id}/complete`)
            .send({ idempotencyKey: 'key-1' });

        expect(res.status).toBe(409);
        expect(res.body.code).toBe('PRICE_CHANGE_UNACKED');
        expect(res.body.session.status).toBe('price_changed');
        expect(res.body.session.currentPrice).toBe(999);
    });

    test('rejects completion once expired, even without a prior resume', async () => {
        const session = await createSession();
        await new Promise((resolve) => setTimeout(resolve, 100)); // TTL is 50ms in this file

        const res = await request(app)
            .post(`/checkout-sessions/${session.id}/complete`)
            .send({ idempotencyKey: 'key-1' });

        expect(res.status).toBe(409);
        expect(res.body.code).toBe('SESSION_EXPIRED');
    });

    test('payment failure transitions to completion_failed, and a retry can succeed', async () => {
        const session = await createSession();
        setNextPaymentResult(false);

        const failed = await request(app)
            .post(`/checkout-sessions/${session.id}/complete`)
            .send({ idempotencyKey: 'key-1' });

        expect(failed.status).toBe(200);
        expect(failed.body.session.status).toBe('completion_failed');

        setNextPaymentResult(true);
        const retried = await request(app)
            .post(`/checkout-sessions/${session.id}/complete`)
            .send({ idempotencyKey: 'key-2' });

        expect(retried.body.session.status).toBe('completed');
        expect(retried.body.session.orderId).toBeDefined();
    });

    test('a paymentMethodId sent on completion is recorded on the session', async () => {
        const session = await createSession();

        const res = await request(app)
            .post(`/checkout-sessions/${session.id}/complete`)
            .send({ idempotencyKey: 'key-1', paymentMethodId: 'pm-seed-visa' });

        expect(res.status).toBe(200);
        expect(res.body.session.status).toBe('completed');
        expect(res.body.session.paymentMethodId).toBe('pm-seed-visa');
    });

    test('two concurrent completions never produce two different orders', async () => {
        const session = await createSession();

        const [a, b] = await Promise.all([
            request(app).post(`/checkout-sessions/${session.id}/complete`).send({ idempotencyKey: 'device-a' }),
            request(app).post(`/checkout-sessions/${session.id}/complete`).send({ idempotencyKey: 'device-b' }),
        ]);

        const responses = [a, b];
        const completed = responses.filter((r) => r.body.session?.status === 'completed');
        const conflicts = responses.filter((r) => r.status === 409 && r.body.code === 'COMPLETION_IN_PROGRESS');

        // Depending on exact timing, the second request either sees the lock
        // mid-flight (409 conflict) or lands after completion and gets the
        // same order back idempotently (also valid) — both are acceptable
        // race outcomes. What must always hold: never two different orders.
        expect(completed.length + conflicts.length).toBe(2);
        expect(completed.length).toBeGreaterThanOrEqual(1);

        const orderIds = new Set(completed.map((r) => r.body.session.orderId));
        expect(orderIds.size).toBe(1);
    });
});
