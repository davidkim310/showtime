'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { CheckoutSessionStatus } from '@/server/types/checkout-session';

function formatRemaining(ms: number): string {
    if (ms <= 0) return '0:00';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function Countdown({ expiresAt, status }: { expiresAt: string; status: CheckoutSessionStatus }) {
    const router = useRouter();
    const [, startTransition] = useTransition();
    const [now, setNow] = useState(() => Date.now());
    const isCountingDown = status === 'active' || status === 'price_changed';
    const remaining = new Date(expiresAt).getTime() - now;

    useEffect(() => {
        if (!isCountingDown) return;
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, [isCountingDown]);

    // The backend is the source of truth for expiration — the client never
    // decides a session is expired on its own. Once the visible countdown
    // hits zero, re-render from the server so it re-evaluates via the real
    // resume path. router.refresh() replaces the old full page reload: it
    // re-runs the Server Component without tearing down the page.
    useEffect(() => {
        if (isCountingDown && remaining <= 0) {
            startTransition(() => router.refresh());
        }
    }, [isCountingDown, remaining <= 0, router]);

    if (!isCountingDown) return null;

    return (
        <>
            Time left to complete purchase: <strong>{formatRemaining(remaining)}</strong>
        </>
    );
}
