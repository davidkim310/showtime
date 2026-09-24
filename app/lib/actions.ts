'use server';

import { refresh } from 'next/cache';
import { acknowledgePrice, addSessionPaymentMethod, completeCheckout } from '@/server/services/checkoutService';

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

export type CheckoutActionResult = { ok: true } | { ok: false; error: string };

// Both actions end in refresh(), which re-renders the page from the server as
// part of the same round trip — rendering the checkout page is itself a resume,
// so this is what shows the buyer the session's real current state.

export async function acknowledgePriceChange(sessionId: string): Promise<CheckoutActionResult> {
    const { body } = acknowledgePrice(sessionId);
    if ('error' in body) return { ok: false, error: body.error };

    refresh();
    return { ok: true };
}

export async function completePurchase(
    sessionId: string,
    input: { idempotencyKey: string; paymentMethodId?: string },
): Promise<CheckoutActionResult> {
    const { body } = await completeCheckout(sessionId, input);
    // COMPLETION_IN_PROGRESS isn't an error to show the buyer: another device
    // is mid-completion, so re-render to reflect whatever is true now.
    if ('error' in body && body.code !== 'COMPLETION_IN_PROGRESS') {
        return { ok: false, error: body.error };
    }

    refresh();
    return { ok: true };
}
