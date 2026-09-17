'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function SelectListing({ listingId, maxQty }: { listingId: string; maxQty: number }) {
    const router = useRouter();
    const [qty, setQty] = useState(Math.min(2, maxQty));
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleContinue() {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/checkout-sessions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ listingId, qty }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Could not start checkout');
            router.push(`/checkout/${data.session.id}`);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Something went wrong');
            setLoading(false);
        }
    }

    return (
        <div>
            <label htmlFor="qty" style={{ display: 'block', marginBottom: 8, color: '#a3a3a3', fontSize: 14 }}>
                Quantity
            </label>
            <select
                id="qty"
                className="listing-select"
                value={qty}
                onChange={(e) => setQty(Number(e.target.value))}
                style={{ marginBottom: 20, display: 'block' }}
            >
                {Array.from({ length: maxQty }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                        {n}
                    </option>
                ))}
            </select>
            {error && (
                <p className="cta-note" style={{ color: '#f28b8b' }}>
                    {error}
                </p>
            )}
            <button className="cta-button" onClick={handleContinue} disabled={loading}>
                {loading ? 'Starting checkout…' : 'CONTINUE'}
            </button>
        </div>
    );
}
