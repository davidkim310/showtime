import { z } from 'zod';

export const createSessionSchema = z.object({
    listingId: z.string().min(1),
    qty: z.number().int().positive(),
});

// Only ever the derived, non-sensitive summary of a card — never a full
// card number or CVC. See paymentMethodsService.ts for why.
export const addPaymentMethodSchema = z.object({
    cardholderName: z.string().min(1),
    brand: z.enum(['visa', 'mastercard', 'amex', 'discover']),
    last4: z.string().regex(/^\d{4}$/),
    expMonth: z.number().int().min(1).max(12),
    expYear: z.number().int().min(new Date().getFullYear()),
});
