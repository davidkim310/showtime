import type { CheckoutSession, CheckoutSessionStatus } from '@/server/types/checkout-session';

export function statusMessage(session: CheckoutSession): string {
    const messages: Record<CheckoutSessionStatus, string> = {
        active: 'Ready to complete your purchase.',
        price_changed: 'Price changed since you started checkout.',
        expired:
            session.expiredReason === 'inventory'
                ? 'These tickets are no longer available.'
                : 'Your checkout hold has expired.',
        payment_pending: "We're confirming your order. Don't refresh or retry payment yet.",
        completed: 'Order complete!',
        completion_failed: "Your payment didn't go through — you haven't been charged. Please try again.",
    };

    return messages[session.status];
}

export const STATUS_TONE: Record<CheckoutSessionStatus, 'warning' | 'danger' | 'info' | 'success' | null> = {
    active: null,
    price_changed: 'warning',
    expired: 'danger',
    payment_pending: 'info',
    completed: 'success',
    completion_failed: 'danger',
};
