import { api } from './routeHandler';
import { resetListing } from '../src/server/services/inventoryService';

const LISTING_ID = 'lakers-warriors-112-14';

afterEach(() => {
    resetListing(LISTING_ID);
});

describe('POST /api/checkout-sessions input validation', () => {
    test('accepts a valid listingId and qty', async () => {
        const res = await api.createSession({ listingId: LISTING_ID, qty: 2 });

        expect(res.status).toBe(201);
        expect(res.body.session.status).toBe('active');
    });

    test('rejects a missing listingId', async () => {
        const res = await api.createSession({ qty: 2 });

        expect(res.status).toBe(400);
        expect(res.body.code).toBe('INVALID_INPUT');
    });

    test('rejects an empty-string listingId', async () => {
        const res = await api.createSession({ listingId: '', qty: 2 });

        expect(res.status).toBe(400);
        expect(res.body.code).toBe('INVALID_INPUT');
    });

    test('rejects qty of zero', async () => {
        const res = await api.createSession({ listingId: LISTING_ID, qty: 0 });

        expect(res.status).toBe(400);
        expect(res.body.code).toBe('INVALID_INPUT');
    });

    test('rejects a negative qty', async () => {
        const res = await api.createSession({ listingId: LISTING_ID, qty: -5 });

        expect(res.status).toBe(400);
        expect(res.body.code).toBe('INVALID_INPUT');
    });

    test('rejects a non-integer qty', async () => {
        const res = await api.createSession({ listingId: LISTING_ID, qty: 2.5 });

        expect(res.status).toBe(400);
        expect(res.body.code).toBe('INVALID_INPUT');
    });

    test('rejects a non-numeric qty', async () => {
        const res = await api.createSession({ listingId: LISTING_ID, qty: 'banana' });

        expect(res.status).toBe(400);
        expect(res.body.code).toBe('INVALID_INPUT');
    });
});
