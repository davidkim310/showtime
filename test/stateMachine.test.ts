import { applyResumeTransition, applyAcknowledgePrice } from '../src/server/stateMachine';
import { CheckoutSession } from '../src/server/types/checkout-session';
import { Listing } from '../src/server/services/inventoryService';

function makeSession(overrides: Partial<CheckoutSession> = {}): CheckoutSession {
    return {
        id: 'session-1',
        listingId: 'listing-1',
        event: {
            title: 'Lakers vs. Warriors',
            venue: 'Crypto.com Arena',
            city: 'Los Angeles, CA',
            startsAt: '2026-08-01T19:30:00.000Z',
        },
        listing: { section: '112', row: '14', qty: 2, deliveryMethod: 'mobile_transfer' },
        priceAtHold: 145,
        currentPrice: 145,
        priceChangeAcknowledged: false,
        status: 'active',
        createdAt: '2026-07-17T00:00:00.000Z',
        expiresAt: '2026-07-17T00:10:00.000Z',
        version: 1,
        ...overrides,
    };
}

function makeListing(overrides: Partial<Listing> = {}): Listing {
    return {
        id: 'listing-1',
        event: {
            title: 'Lakers vs. Warriors',
            venue: 'Crypto.com Arena',
            city: 'Los Angeles, CA',
            startsAt: '2026-08-01T19:30:00.000Z',
        },
        section: '112',
        row: '14',
        price: 145,
        availableQty: 4,
        ...overrides,
    };
}

describe('applyResumeTransition', () => {
    test('stays active when nothing has changed', () => {
        const session = makeSession();
        const listing = makeListing();
        const now = new Date('2026-07-17T00:05:00.000Z');

        const result = applyResumeTransition(session, listing, now);

        expect(result.status).toBe('active');
    });

    test('expires with reason "ttl" once the hold window has passed', () => {
        const session = makeSession();
        const listing = makeListing();
        const now = new Date(new Date(session.expiresAt).getTime() + 1);

        const result = applyResumeTransition(session, listing, now);

        expect(result.status).toBe('expired');
        expect(result.expiredReason).toBe('ttl');
    });

    test('expires with reason "inventory" when the stub listing is sold out', () => {
        const session = makeSession();
        const listing = makeListing({ availableQty: 0 });
        const now = new Date('2026-07-17T00:05:00.000Z');

        const result = applyResumeTransition(session, listing, now);

        expect(result.status).toBe('expired');
        expect(result.expiredReason).toBe('inventory');
    });

    test('flags a price change when the stub price no longer matches priceAtHold', () => {
        const session = makeSession();
        const listing = makeListing({ price: 160 });
        const now = new Date('2026-07-17T00:05:00.000Z');

        const result = applyResumeTransition(session, listing, now);

        expect(result.status).toBe('price_changed');
        expect(result.currentPrice).toBe(160);
    });

    test('does not re-flag a price change the buyer already acknowledged', () => {
        const session = makeSession({ priceAtHold: 160, priceChangeAcknowledged: true });
        const listing = makeListing({ price: 160 });
        const now = new Date('2026-07-17T00:05:00.000Z');

        const result = applyResumeTransition(session, listing, now);

        expect(result.status).toBe('active');
    });

    test('does not disturb a session that is already payment_pending', () => {
        const session = makeSession({ status: 'payment_pending' });
        const listing = makeListing({ price: 999 }); // even a price change shouldn't matter here
        const now = new Date(new Date(session.expiresAt).getTime() + 1); // even past expiry shouldn't matter here

        const result = applyResumeTransition(session, listing, now);

        expect(result.status).toBe('payment_pending');
    });

    test('does not reopen a completed session', () => {
        const session = makeSession({ status: 'completed', orderId: 'order-1' });
        const listing = makeListing({ availableQty: 0 }); // even sold out shouldn't matter here
        const now = new Date('2026-07-17T00:05:00.000Z');

        const result = applyResumeTransition(session, listing, now);

        expect(result.status).toBe('completed');
        expect(result.orderId).toBe('order-1');
    });

    test('does not silently clear a completion_failed session back to active', () => {
        const session = makeSession({ status: 'completion_failed' });
        const listing = makeListing(); // nothing else wrong — price/inventory/TTL all fine
        const now = new Date('2026-07-17T00:05:00.000Z');

        const result = applyResumeTransition(session, listing, now);

        expect(result.status).toBe('completion_failed');
    });
});

describe('applyAcknowledgePrice', () => {
    test('accepts the new price and returns to active', () => {
        const session = makeSession({
            status: 'price_changed',
            priceAtHold: 145,
            currentPrice: 160,
            priceChangeAcknowledged: false,
        });

        const result = applyAcknowledgePrice(session);

        expect(result.status).toBe('active');
        expect(result.priceAtHold).toBe(160);
        expect(result.priceChangeAcknowledged).toBe(true);
    });
});
