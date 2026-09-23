'use server';

import { addSessionPaymentMethod } from '@/server/services/checkoutService';

export type SaveCardResult = { ok: true; paymentMethodId: string } | { ok: false; error: string };

// Receives only the non-sensitive summary of a card — the number and CVC stay
// on the buyer's device. Validation still happens inside addSessionPaymentMethod,
// because a Server Action is a public POST endpoint like any other: the typed
// signature constrains this app's callers, not an attacker's.
export async function saveCard(sessionId: string, summary: unknown): Promise<SaveCardResult> {
    const { body } = addSessionPaymentMethod(sessionId, summary);

    return 'paymentMethod' in body
        ? { ok: true, paymentMethodId: body.paymentMethod.id }
        : { ok: false, error: body.error };
}
