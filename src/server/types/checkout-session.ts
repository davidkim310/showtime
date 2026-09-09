export type CheckoutSessionStatus =
    | 'active'
    | 'price_changed'
    | 'expired'
    | 'payment_pending'
    | 'completed'
    | 'completion_failed';

export type ExpiredReason = 'ttl' | 'inventory';

export type CheckoutSurface = 'web' | 'mobile';

export type CheckoutSession = {
    id: string;
    listingId: string;
    event: { title: string; venue: string; city: string; startsAt: string };
    listing: { section: string; row: string; qty: number; deliveryMethod: 'mobile_transfer' };

    priceAtHold: number;
    currentPrice: number;
    priceChangeAcknowledged: boolean;

    status: CheckoutSessionStatus;
    expiredReason?: ExpiredReason;

    createdAt: string;
    expiresAt: string;
    lastResumedSurface?: CheckoutSurface;
    completedOnSurface?: CheckoutSurface;
    orderId?: string;

    version: number;
    idempotencyKey?: string;
    paymentMethodId?: string;
};
