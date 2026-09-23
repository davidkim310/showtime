'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ChangeEvent, FormEvent } from 'react';
import {
    cardNumberSchema,
    cardholderNameSchema,
    expDateSchema,
    cvcSchema,
    creditCardFormSchema,
    formatCardNumber,
    formatExpDate,
    formatCvc,
    formatCardholderName,
    detectCardIssuer,
} from '@/client/creditCard';
import type { CreditCardFormInput } from '@/client/creditCard';
import { saveCard } from '../lib/actions';

type FieldName = keyof CreditCardFormInput;

const emptyCardForm: CreditCardFormInput = {
    cardNumber: '',
    cardholderName: '',
    expDate: '',
    cvc: '',
};

function validateField(name: FieldName, values: CreditCardFormInput): string | null {
    if (name === 'cardNumber') {
        const result = cardNumberSchema.safeParse(values.cardNumber);
        return result.success ? null : result.error.issues[0]?.message ?? 'Invalid value';
    }
    if (name === 'cardholderName') {
        const result = cardholderNameSchema.safeParse(values.cardholderName);
        return result.success ? null : result.error.issues[0]?.message ?? 'Invalid value';
    }
    if (name === 'expDate') {
        const result = expDateSchema.safeParse(values.expDate);
        return result.success ? null : result.error.issues[0]?.message ?? 'Invalid value';
    }

    const shapeResult = cvcSchema.safeParse(values.cvc);
    if (!shapeResult.success) return shapeResult.error.issues[0]?.message ?? 'Invalid value';
    const issuer = detectCardIssuer(values.cardNumber);
    if (issuer && values.cvc.length !== issuer.cvcLength) {
        return `${issuer.label} CVC must be ${issuer.cvcLength} digits`;
    }
    return null;
}

export function AddPaymentMethodForm({ sessionId }: { sessionId: string }) {
    const router = useRouter();
    const [values, setValues] = useState<CreditCardFormInput>(emptyCardForm);
    const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
    const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({});
    const [saving, setSaving] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    const isFormValid = useMemo(() => creditCardFormSchema.safeParse(values).success, [values]);
    const issuer = useMemo(() => detectCardIssuer(values.cardNumber), [values.cardNumber]);

    function updateField(name: FieldName, formatter: (raw: string) => string) {
        return (event: ChangeEvent<HTMLInputElement>) => {
            const formatted = formatter(event.target.value);
            const next = { ...values, [name]: formatted };
            setValues(next);
            setErrors((prev) => {
                const updated = { ...prev, [name]: validateField(name, next) ?? undefined };
                if (name === 'cardNumber' && touched.cvc) {
                    updated.cvc = validateField('cvc', next) ?? undefined;
                }
                return updated;
            });
        };
    }

    function handleBlur(name: FieldName) {
        return () => {
            setTouched((prev) => ({ ...prev, [name]: true }));
            setErrors((prev) => ({ ...prev, [name]: validateField(name, values) ?? undefined }));
        };
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setTouched({ cardNumber: true, cardholderName: true, expDate: true, cvc: true });
        const result = creditCardFormSchema.safeParse(values);
        if (!result.success) return;

        const detectedIssuer = detectCardIssuer(result.data.cardNumber);
        if (!detectedIssuer) return;
        const [expMonth, expYear] = result.data.expDate.split('/').map(Number);

        setSaving(true);
        setSubmitError(null);
        try {
            // Only the summary crosses the network: the card number and CVC
            // never leave the browser, which is why this calls the action
            // directly instead of using <form action>, where a named field
            // would be submitted to the server.
            const saved = await saveCard(sessionId, {
                cardholderName: result.data.cardholderName,
                brand: detectedIssuer.id,
                last4: result.data.cardNumber.slice(-4),
                expMonth,
                expYear: 2000 + expYear,
            });
            if (!saved.ok) throw new Error(saved.error);
            router.push(`/checkout/${sessionId}?paymentMethodId=${saved.paymentMethodId}`);
        } catch (err) {
            setSubmitError(err instanceof Error ? err.message : 'Something went wrong');
            setSaving(false);
        }
    }

    const fieldError = (name: FieldName) => (touched[name] ? errors[name] : undefined);

    return (
        <form onSubmit={handleSubmit} noValidate>
            <label className="form-field">
                <span className="form-label-row">
                    <span className="form-label">Card Number</span>
                    {issuer && <span className="issuer-badge">{issuer.label}</span>}
                </span>
                <input
                    type="text"
                    inputMode="numeric"
                    placeholder="1234 5678 9012 3456"
                    value={values.cardNumber}
                    onChange={updateField('cardNumber', formatCardNumber)}
                    onBlur={handleBlur('cardNumber')}
                    className={fieldError('cardNumber') ? 'input-error' : ''}
                    aria-invalid={Boolean(fieldError('cardNumber'))}
                />
                {fieldError('cardNumber') && <span className="error-message">{fieldError('cardNumber')}</span>}
            </label>

            <label className="form-field">
                <span className="form-label">Cardholder Name</span>
                <input
                    type="text"
                    placeholder="Jane Doe"
                    value={values.cardholderName}
                    onChange={updateField('cardholderName', formatCardholderName)}
                    onBlur={handleBlur('cardholderName')}
                    className={fieldError('cardholderName') ? 'input-error' : ''}
                    aria-invalid={Boolean(fieldError('cardholderName'))}
                />
                {fieldError('cardholderName') && (
                    <span className="error-message">{fieldError('cardholderName')}</span>
                )}
            </label>

            <div className="form-row">
                <label className="form-field">
                    <span className="form-label">Expiration (MM/YY)</span>
                    <input
                        type="text"
                        inputMode="numeric"
                        placeholder="MM/YY"
                        value={values.expDate}
                        onChange={updateField('expDate', formatExpDate)}
                        onBlur={handleBlur('expDate')}
                        className={fieldError('expDate') ? 'input-error' : ''}
                        aria-invalid={Boolean(fieldError('expDate'))}
                    />
                    {fieldError('expDate') && <span className="error-message">{fieldError('expDate')}</span>}
                </label>

                <label className="form-field">
                    <span className="form-label">CVC</span>
                    <input
                        type="text"
                        inputMode="numeric"
                        placeholder="123"
                        value={values.cvc}
                        onChange={updateField('cvc', formatCvc)}
                        onBlur={handleBlur('cvc')}
                        className={fieldError('cvc') ? 'input-error' : ''}
                        aria-invalid={Boolean(fieldError('cvc'))}
                    />
                    {fieldError('cvc') && <span className="error-message">{fieldError('cvc')}</span>}
                </label>
            </div>

            {submitError && (
                <p className="cta-note" style={{ color: '#f28b8b' }}>
                    {submitError}
                </p>
            )}

            <button type="submit" className="cta-button" disabled={!isFormValid || saving}>
                {saving ? 'Saving…' : 'Save Card'}
            </button>
        </form>
    );
}
