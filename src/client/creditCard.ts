import { z } from 'zod';

// Card issuer detection, formatting, and validation — pure, framework-free
// logic with nothing checkout-continuity-specific about it, ported from an
// earlier standalone checkout form. The navigate/sessionStorage/order glue
// from that original context doesn't apply here and is left out.

// ---------- Card issuer detection ----------

export type CardIssuerId = 'visa' | 'mastercard' | 'amex' | 'discover';

export interface CardIssuer {
    id: CardIssuerId;
    label: string;
    cardLength: number;
    cvcLength: number;
}

const CARD_ISSUERS: Array<CardIssuer & { pattern: RegExp }> = [
    { id: 'amex', label: 'American Express', cardLength: 15, cvcLength: 4, pattern: /^3[47]/ },
    { id: 'visa', label: 'Visa', cardLength: 16, cvcLength: 3, pattern: /^4/ },
    {
        id: 'mastercard',
        label: 'Mastercard',
        cardLength: 16,
        cvcLength: 3,
        pattern: /^(5[1-5]|222[1-9]|22[3-9]\d|2[3-6]\d{2}|27[01]\d|2720)/,
    },
    { id: 'discover', label: 'Discover', cardLength: 16, cvcLength: 3, pattern: /^(6011|65|64[4-9])/ },
];

export function detectCardIssuer(cardNumber: string): CardIssuer | null {
    const digits = cardNumber.replace(/\D/g, '');
    const issuer = CARD_ISSUERS.find((candidate) => candidate.pattern.test(digits));
    return issuer
        ? { id: issuer.id, label: issuer.label, cardLength: issuer.cardLength, cvcLength: issuer.cvcLength }
        : null;
}

// ---------- Auto-formatting helpers ----------

export function formatCardNumber(rawValue: string): string {
    const rawDigits = rawValue.replace(/\D/g, '');
    const issuer = detectCardIssuer(rawDigits);
    const digits = rawDigits.slice(0, issuer?.cardLength ?? 16);

    if (issuer?.id === 'amex') {
        // Amex groups as 4-6-5, e.g. 3782 822463 10005
        return [digits.slice(0, 4), digits.slice(4, 10), digits.slice(10, 15)].filter(Boolean).join(' ');
    }
    return digits.replace(/(.{4})/g, '$1 ').trim();
}

export function formatExpDate(rawValue: string): string {
    const digits = rawValue.replace(/\D/g, '').slice(0, 4);
    if (digits.length < 3) return digits;
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

export function formatCvc(rawValue: string): string {
    return rawValue.replace(/\D/g, '').slice(0, 4);
}

export function formatCardholderName(rawValue: string): string {
    return rawValue.replace(/[^A-Za-z\s'-]/g, '').replace(/\s{2,}/g, ' ');
}

// ---------- Validation ----------

function luhnCheck(digits: string): boolean {
    let sum = 0;
    let shouldDouble = false;
    for (let i = digits.length - 1; i >= 0; i--) {
        let digit = Number(digits[i]);
        if (shouldDouble) {
            digit *= 2;
            if (digit > 9) digit -= 9;
        }
        sum += digit;
        shouldDouble = !shouldDouble;
    }
    return sum % 10 === 0;
}

function isNotExpired(expDate: string): boolean {
    const match = /^(\d{2})\/(\d{2})$/.exec(expDate);
    if (!match) return false;
    const month = Number(match[1]);
    const year = 2000 + Number(match[2]);

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    if (year > currentYear) return true;
    if (year === currentYear && month >= currentMonth) return true;
    return false;
}

export const cardNumberSchema = z
    .string()
    .transform((val) => val.replace(/\s/g, ''))
    .pipe(
        z.string().superRefine((digits, ctx) => {
            const issuer = detectCardIssuer(digits);
            if (!/^\d+$/.test(digits) || !issuer) {
                ctx.addIssue({ code: 'custom', message: 'Enter a valid card number' });
                return;
            }
            if (digits.length !== issuer.cardLength) {
                ctx.addIssue({
                    code: 'custom',
                    message: `${issuer.label} card numbers are ${issuer.cardLength} digits`,
                });
                return;
            }
            if (!luhnCheck(digits)) {
                ctx.addIssue({ code: 'custom', message: 'Card number is invalid' });
            }
        })
    );

export const cardholderNameSchema = z
    .string()
    .trim()
    .min(1, 'Cardholder name is required')
    .regex(/^[A-Za-z]+(?:[\s'-][A-Za-z]+)*$/, 'Enter a valid name');

export const expDateSchema = z
    .string()
    .regex(/^(0[1-9]|1[0-2])\/\d{2}$/, 'Use MM/YY format')
    .refine(isNotExpired, 'Card has expired');

export const cvcSchema = z.string().regex(/^\d{3,4}$/, 'CVC must be 3-4 digits');

export const creditCardFormSchema = z
    .object({
        cardNumber: cardNumberSchema,
        cardholderName: cardholderNameSchema,
        expDate: expDateSchema,
        cvc: cvcSchema,
    })
    .superRefine((values, ctx) => {
        const issuer = detectCardIssuer(values.cardNumber);
        if (issuer && values.cvc.length !== issuer.cvcLength) {
            ctx.addIssue({
                code: 'custom',
                path: ['cvc'],
                message: `${issuer.label} CVC must be ${issuer.cvcLength} digits`,
            });
        }
    });

export type CreditCardFormValues = z.infer<typeof creditCardFormSchema>;
export type CreditCardFormInput = {
    cardNumber: string;
    cardholderName: string;
    expDate: string;
    cvc: string;
};
