import request from 'supertest';
import app from '../src/server/app';
import { getSavedPaymentMethods, addPaymentMethod } from '../src/server/services/paymentMethodsService';

const LISTING_ID = 'lakers-warriors-112-14';

async function createSession() {
    const res = await request(app).post('/checkout-sessions').send({ listingId: LISTING_ID, qty: 2 });
    return res.body.session;
}

describe('paymentMethodsService', () => {
    test('starts with the two seeded cards', () => {
        const methods = getSavedPaymentMethods();

        expect(methods).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ id: 'pm-seed-visa', brand: 'visa', last4: '4242' }),
                expect.objectContaining({ id: 'pm-seed-mastercard', brand: 'mastercard', last4: '8210' }),
            ])
        );
    });

    test('addPaymentMethod assigns an id and appends to the saved list', () => {
        const before = getSavedPaymentMethods().length;

        const added = addPaymentMethod({
            cardholderName: 'Test User',
            brand: 'discover',
            last4: '1117',
            expMonth: 6,
            expYear: 2030,
        });

        expect(added.id).toBeDefined();
        expect(getSavedPaymentMethods()).toHaveLength(before + 1);
        expect(getSavedPaymentMethods()).toContainEqual(added);
    });
});

describe('POST /checkout-sessions/:id/payment-methods', () => {
    test('saves a valid card and returns it', async () => {
        const session = await createSession();

        const res = await request(app).post(`/checkout-sessions/${session.id}/payment-methods`).send({
            cardholderName: 'Jane Doe',
            brand: 'visa',
            last4: '9999',
            expMonth: 12,
            expYear: 2030,
        });

        expect(res.status).toBe(201);
        expect(res.body.paymentMethod.last4).toBe('9999');
        expect(getSavedPaymentMethods()).toContainEqual(res.body.paymentMethod);
    });

    test('rejects an unknown session id', async () => {
        const res = await request(app).post('/checkout-sessions/nonexistent/payment-methods').send({
            cardholderName: 'Jane Doe',
            brand: 'visa',
            last4: '9999',
            expMonth: 12,
            expYear: 2030,
        });

        expect(res.status).toBe(404);
        expect(res.body.code).toBe('SESSION_NOT_FOUND');
    });

    test('rejects a last4 that is not exactly 4 digits', async () => {
        const session = await createSession();

        const res = await request(app).post(`/checkout-sessions/${session.id}/payment-methods`).send({
            cardholderName: 'Jane Doe',
            brand: 'visa',
            last4: '99',
            expMonth: 12,
            expYear: 2030,
        });

        expect(res.status).toBe(400);
        expect(res.body.code).toBe('INVALID_INPUT');
    });

    test('rejects an unsupported brand', async () => {
        const session = await createSession();

        const res = await request(app).post(`/checkout-sessions/${session.id}/payment-methods`).send({
            cardholderName: 'Jane Doe',
            brand: 'diners-club',
            last4: '9999',
            expMonth: 12,
            expYear: 2030,
        });

        expect(res.status).toBe(400);
        expect(res.body.code).toBe('INVALID_INPUT');
    });
});
