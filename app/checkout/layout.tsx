import { SiteHeader } from '../components/SiteHeader';

// Every checkout page already lives under checkout/, so an ordinary segment
// layout covers them — no route group needed.
export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            <SiteHeader title="🛡 Checkout" />
            {children}
        </>
    );
}
