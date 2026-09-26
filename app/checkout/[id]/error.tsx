'use client';

import { SiteHeader } from '../../components/SiteHeader';

// Checkout gets its own boundary because the stakes differ: this can appear
// after a buyer pressed Complete Purchase, when whether they were charged is
// exactly what they don't know. Reloading re-runs the resume and shows the
// session's real status, so that's what we point them at — never a second
// payment attempt.
export default function CheckoutError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
    return (
        <>
            <SiteHeader title="🛡 Checkout" />
            <main style={{ gridTemplateColumns: '1fr', maxWidth: 560 }}>
                <div className="card">
                    <h1 className="event-title">We couldn&rsquo;t load your checkout</h1>
                    <p className="event-meta">
                        Don&rsquo;t enter your payment details again. Reload to see where your order actually stands —
                        if it went through, it will say so.
                        {error.digest ? ` Reference: ${error.digest}` : ''}
                    </p>
                    <button className="cta-button" onClick={() => retry()}>
                        Reload Checkout
                    </button>
                    <a className="view-on-mobile" href="/">
                        Back to events
                    </a>
                </div>
            </main>
        </>
    );
}
