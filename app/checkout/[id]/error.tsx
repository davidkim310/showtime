'use client';

import { CheckoutErrorNotice, type ErrorBoundaryProps } from '../../components/CheckoutErrorNotice';

export default function CheckoutError(props: ErrorBoundaryProps) {
    return (
        <main style={{ gridTemplateColumns: '1fr', maxWidth: 560 }}>
            <CheckoutErrorNotice {...props} />
        </main>
    );
}
