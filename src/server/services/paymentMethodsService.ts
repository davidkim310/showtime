import { randomUUID } from 'node:crypto';

export type CardBrand = 'visa' | 'mastercard' | 'amex' | 'discover';

export type PaymentMethod = {
    id: string;
    brand: CardBrand;
    last4: string;
    expMonth: number;
    expYear: number;
    cardholderName: string;
};

// Global, in-memory stub — there's no user/account concept anywhere in this
// app (sessions are anonymous, keyed only by session id), so "saved cards"
// can't be scoped to a real user. Mirrors inventoryService.ts's Map-based
// stub pattern: seeded on module load, mutated in place, resets on restart.
const paymentMethods = new Map<string, PaymentMethod>(
    [
        {
            id: 'pm-seed-visa',
            brand: 'visa' as const,
            last4: '4242',
            expMonth: 8,
            expYear: 2029,
            cardholderName: 'Jane Doe',
        },
        {
            id: 'pm-seed-mastercard',
            brand: 'mastercard' as const,
            last4: '8210',
            expMonth: 3,
            expYear: 2028,
            cardholderName: 'Jane Doe',
        },
    ].map((pm) => [pm.id, pm])
);

export function getSavedPaymentMethods(): PaymentMethod[] {
    return Array.from(paymentMethods.values());
}

export function getPaymentMethod(paymentMethodId: string | undefined): PaymentMethod | undefined {
    if (!paymentMethodId) return undefined;
    return paymentMethods.get(paymentMethodId);
}

// Only ever receives {cardholderName, brand, last4, expMonth, expYear} —
// the full card number and CVC never leave the client. The client derives
// brand/last4 itself before sending, the same way a real integration would
// tokenize on the client and only ever hand the server the minimal,
// non-sensitive summary it needs to display later.
export function addPaymentMethod(input: Omit<PaymentMethod, 'id'>): PaymentMethod {
    const paymentMethod: PaymentMethod = { id: randomUUID(), ...input };
    paymentMethods.set(paymentMethod.id, paymentMethod);
    return paymentMethod;
}
