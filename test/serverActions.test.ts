import { saveCard } from '../app/lib/actions';
import { api } from './routeHandler';
import { getSavedPaymentMethods } from '../src/server/services/paymentMethodsService';

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
