'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { ChangeEvent } from 'react';
import type { CheckoutSession } from '@/server/types/checkout-session';
import type { PaymentMethod } from '@/server/services/paymentMethodsService';

const ADD_NEW_CARD = '__add_new_card__';

function PaymentMethodSelect({
    sessionId,
    savedPaymentMethods,
    selectedId,
    onChange,
}: {
    sessionId: string;
    savedPaymentMethods: PaymentMethod[];
    selectedId: string;
    onChange: (id: string) => void;
}) {
    const router = useRouter();

    function handleChange(e: ChangeEvent<HTMLSelectElement>) {
        const value = e.target.value;
        if (value === ADD_NEW_CARD) {
            router.push(`/checkout/${sessionId}/payment-methods/new`);
            return;
        }
        onChange(value);
    }

    return (
        <select
            className="listing-select"
            value={selectedId}
            onChange={handleChange}
            style={{ marginBottom: 12, display: 'block', width: '100%' }}
        >
            {savedPaymentMethods.map((pm) => (
                <option key={pm.id} value={pm.id}>
                    {pm.brand[0].toUpperCase() + pm.brand.slice(1)} •••• {pm.last4}
                </option>
            ))}
            <option value={ADD_NEW_CARD}>+ Add a new card</option>
        </select>
    );
}

export function CtaButton({
    session,
    savedPaymentMethods,
    initialPaymentMethodId,
    paidWithLabel,
}: {
    session: CheckoutSession;
    savedPaymentMethods: PaymentMethod[];
    initialPaymentMethodId?: string;
    paidWithLabel?: string;
}) {
    const router = useRouter();
    // isPending covers the window where router.refresh() is re-rendering the
    // page from the server. Unlike the full page reload this replaced, the
    // component survives the refresh — so `busy` alone would stay stuck on
    // and leave the button reading "Completing…" forever.
    const [isPending, startTransition] = useTransition();
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState(
        () => initialPaymentMethodId ?? savedPaymentMethods[0]?.id ?? '',
    );

    const disabled = busy || isPending;

    async function acknowledgePrice() {
        setBusy(true);
        setMessage(null);
        try {
            const res = await fetch(`/api/checkout-sessions/${session.id}/acknowledge-price`, { method: 'POST' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Could not accept new price');
            startTransition(() => router.refresh());
            setBusy(false);
        } catch (err) {
            setMessage(err instanceof Error ? err.message : 'Something went wrong');
            setBusy(false);
        }
    }

    async function completePurchase() {
        setBusy(true);
        setMessage(null);
        try {
            const res = await fetch(`/api/checkout-sessions/${session.id}/complete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    idempotencyKey: crypto.randomUUID(),
                    paymentMethodId: selectedPaymentMethodId,
                }),
            });
            const data = await res.json();
            // COMPLETION_IN_PROGRESS isn't really an error to show the buyer —
            // it means another device is mid-completion, so refresh to reflect
            // the real current state (payment_pending, or completed if it
            // finished by the time this lands).
            if (!res.ok && data.code !== 'COMPLETION_IN_PROGRESS') {
                throw new Error(data.error || 'Could not complete purchase');
            }
            startTransition(() => router.refresh());
            setBusy(false);
        } catch (err) {
            setMessage(err instanceof Error ? err.message : 'Something went wrong');
            setBusy(false);
        }
    }

    switch (session.status) {
        case 'price_changed':
            return (
                <div>
                    <button className="cta-button" onClick={acknowledgePrice} disabled={disabled}>
                        {disabled ? 'Accepting…' : 'Accept New Price'}
                    </button>
                    {message && <p className="cta-note">{message}</p>}
                </div>
            );
        case 'expired':
            return (
                <a className="cta-button" href="/">
                    Find Similar Tickets
                </a>
            );
        case 'payment_pending':
            return (
                <button
                    className="cta-button cta-secondary"
                    onClick={() => startTransition(() => router.refresh())}
                    disabled={isPending}
                >
                    {isPending ? 'Checking…' : 'Check Status'}
                </button>
            );
        case 'completed':
            return (
                <div>
                    <button className="cta-button" disabled>
                        View Order
                    </button>
                    <p className="cta-note">
                        Order ID: {session.orderId}
                        {paidWithLabel ? ` · ${paidWithLabel}` : ''}
                    </p>
                </div>
            );
        case 'completion_failed':
            return (
                <div>
                    <PaymentMethodSelect
                        sessionId={session.id}
                        savedPaymentMethods={savedPaymentMethods}
                        selectedId={selectedPaymentMethodId}
                        onChange={setSelectedPaymentMethodId}
                    />
                    <button className="cta-button" onClick={completePurchase} disabled={disabled}>
                        {disabled ? 'Retrying…' : 'Retry Purchase'}
                    </button>
                    {message && <p className="cta-note">{message}</p>}
                </div>
            );
        case 'active':
        default:
            return (
                <div>
                    <PaymentMethodSelect
                        sessionId={session.id}
                        savedPaymentMethods={savedPaymentMethods}
                        selectedId={selectedPaymentMethodId}
                        onChange={setSelectedPaymentMethodId}
                    />
                    <button className="cta-button" onClick={completePurchase} disabled={disabled}>
                        {disabled ? 'Completing…' : 'Complete Purchase'}
                    </button>
                    {message && <p className="cta-note">{message}</p>}
                </div>
            );
    }
}
