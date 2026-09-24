'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { ChangeEvent } from 'react';
import type { CheckoutSession } from '@/server/types/checkout-session';
import type { PaymentMethod } from '@/server/services/paymentMethodsService';
import { acknowledgePriceChange, completePurchase, type CheckoutActionResult } from '../lib/actions';

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
    // The action's own refresh() is part of the transition, so isPending stays
    // true until the re-rendered page has arrived — no separate busy flag to
    // reset, and no window where the button is enabled but the page is stale.
    const [isPending, startTransition] = useTransition();
    const [message, setMessage] = useState<string | null>(null);
    const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState(
        () => initialPaymentMethodId ?? savedPaymentMethods[0]?.id ?? '',
    );

    const disabled = isPending;

    function run(action: () => Promise<CheckoutActionResult>) {
        startTransition(async () => {
            setMessage(null);
            const result = await action();
            if (!result.ok) setMessage(result.error);
        });
    }

    const acknowledgePrice = () => run(() => acknowledgePriceChange(session.id));

    const completeThisPurchase = () =>
        run(() =>
            completePurchase(session.id, {
                idempotencyKey: crypto.randomUUID(),
                paymentMethodId: selectedPaymentMethodId,
            }),
        );

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
                    <button className="cta-button" onClick={completeThisPurchase} disabled={disabled}>
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
                    <button className="cta-button" onClick={completeThisPurchase} disabled={disabled}>
                        {disabled ? 'Completing…' : 'Complete Purchase'}
                    </button>
                    {message && <p className="cta-note">{message}</p>}
                </div>
            );
    }
}
