// refresh() re-renders the page from inside a Server Action, and needs a
// request in scope; here the actions are called directly.
jest.mock('next/cache', () => ({ ...jest.requireActual('next/cache'), refresh: jest.fn() }));

import { acknowledgePriceChange, completePurchase, saveCard } from '../app/lib/actions';
import { api } from './routeHandler';
import { getSavedPaymentMethods } from '../src/server/services/paymentMethodsService';
import { setListingPrice, resetListing } from '../src/server/services/inventoryService';

const LISTING_ID = 'lakers-warriors-112-14';

const validCard = {
    cardholderName: 'Jane Doe',
    brand: 'visa',
    last4: '9999',
    expMonth: 12,
    expYear: 2030,
};

async function createSession() {
    const res = await api.createSession({ listingId: LISTING_ID, qty: 2 });
    return res.body.session;
}

describe('saveCard server action', () => {
    test('saves the card and returns its id', async () => {
        const session = await createSession();

        const result = await saveCard(session.id, validCard);

        expect(result).toEqual({ ok: true, paymentMethodId: expect.any(String) });
        expect(getSavedPaymentMethods()).toContainEqual(
            expect.objectContaining({ id: (result as { paymentMethodId: string }).paymentMethodId, last4: '9999' }),
        );
    });

    // The typed signature constrains this app's callers; the action is still a
    // public POST endpoint, so it validates what it is handed.
    test('rejects a card the schema refuses, without saving anything', async () => {
        const session = await createSession();
        const before = getSavedPaymentMethods().length;

        const result = await saveCard(session.id, { ...validCard, last4: '99' });

        expect(result).toEqual({ ok: false, error: 'Invalid input' });
        expect(getSavedPaymentMethods()).toHaveLength(before);
    });

    test('rejects an unknown session', async () => {
        const result = await saveCard('no-such-session', validCard);

        expect(result).toEqual({ ok: false, error: 'Session not found' });
    });
});

describe('checkout server actions', () => {
    afterEach(() => resetListing(LISTING_ID));

    test('completePurchase completes the session', async () => {
        const session = await createSession();

        const result = await completePurchase(session.id, { idempotencyKey: 'key-1' });

        expect(result).toEqual({ ok: true });
        expect((await api.getSession(session.id)).body.session.status).toBe('completed');
    });

    test('acknowledgePriceChange clears a price change so the purchase can complete', async () => {
        const session = await createSession();
        setListingPrice(LISTING_ID, 199);
        await api.resume(session.id, { surface: 'web' });

        expect(await completePurchase(session.id, { idempotencyKey: 'key-1' })).toEqual({
            ok: false,
            error: 'Price change must be acknowledged before completing',
        });

        expect(await acknowledgePriceChange(session.id)).toEqual({ ok: true });
        expect(await completePurchase(session.id, { idempotencyKey: 'key-2' })).toEqual({ ok: true });
        expect((await api.getSession(session.id)).body.session.priceAtHold).toBe(199);
    });

    // Another device completing first isn't a failure to report: the buyer
    // should just see whatever is now true.
    test('a completion already in progress is not reported as an error', async () => {
        const session = await createSession();

        const [first, second] = await Promise.all([
            completePurchase(session.id, { idempotencyKey: 'device-a' }),
            completePurchase(session.id, { idempotencyKey: 'device-b' }),
        ]);

        expect(first).toEqual({ ok: true });
        expect(second).toEqual({ ok: true });
    });

    test('rejects an unknown session', async () => {
        expect(await acknowledgePriceChange('no-such-session')).toEqual({ ok: false, error: 'Session not found' });
        expect(await completePurchase('no-such-session', { idempotencyKey: 'k' })).toEqual({
            ok: false,
            error: 'Session not found',
        });
    });
});
