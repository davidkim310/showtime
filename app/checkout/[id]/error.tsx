'use client';

import { SiteHeader } from '../../components/SiteHeader';
import { CheckoutErrorNotice, type ErrorBoundaryProps } from '../../components/CheckoutErrorNotice';

export default function CheckoutError(props: ErrorBoundaryProps) {
    return (
        <>
            <SiteHeader title="🛡 Checkout" />
            <main style={{ gridTemplateColumns: '1fr', maxWidth: 560 }}>
                <CheckoutErrorNotice {...props} />
            </main>
        </>
    );
}
