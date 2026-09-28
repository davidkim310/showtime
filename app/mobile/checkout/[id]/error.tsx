'use client';

import { CheckoutErrorNotice, type ErrorBoundaryProps } from '../../../components/CheckoutErrorNotice';

// The mobile deep link isn't under app/checkout/[id], so without this a crash
// here would fall through to the generic app boundary — no warning against
// paying twice, on a page with the same Complete Purchase button.
export default function MobileCheckoutError(props: ErrorBoundaryProps) {
    return (
        <div className="phone-frame">
            <div className="phone-statusbar">Opened from mobile deep link</div>
            <div className="phone-content">
                <CheckoutErrorNotice {...props} />
            </div>
        </div>
    );
}
