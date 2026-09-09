import React, { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import type { CheckoutSession, CheckoutSessionStatus } from '../server/types/checkout-session';
import type { Listing } from '../server/services/inventoryService';
import type { PaymentMethod } from '../server/services/paymentMethodsService';
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
} from './creditCard';
import type { CreditCardFormInput } from './creditCard';

const ADD_NEW_CARD = '__add_new_card__';

function formatRemaining(ms: number): string {
    if (ms <= 0) return '0:00';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function Countdown({ expiresAt, status }: { expiresAt: string; status: CheckoutSessionStatus }) {
    const [now, setNow] = useState(() => Date.now());
    const isCountingDown = status === 'active' || status === 'price_changed';
    const remaining = new Date(expiresAt).getTime() - now;

    useEffect(() => {
        if (!isCountingDown) return;
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, [isCountingDown]);

    // The backend is the source of truth for expiration — the client never
    // decides a session is expired on its own. Once the visible countdown
    // hits zero, reload so the server re-evaluates via the real resume path.
    useEffect(() => {
        if (isCountingDown && remaining <= 0) {
            window.location.reload();
        }
    }, [isCountingDown, remaining <= 0]);

    if (!isCountingDown) return null;

    return (
        <>
            Time left to complete purchase: <strong>{formatRemaining(remaining)}</strong>
        </>
    );
}

function PaymentMethodSelect({
    session,
    savedPaymentMethods,
    selectedId,
    onChange,
}: {
    session: CheckoutSession;
    savedPaymentMethods: PaymentMethod[];
    selectedId: string;
    onChange: (id: string) => void;
}) {
    function handleChange(e: ChangeEvent<HTMLSelectElement>) {
        const value = e.target.value;
        if (value === ADD_NEW_CARD) {
            window.location.href = `/checkout/${session.id}/payment-methods/new`;
            return;
        }
        onChange(value);
    }

    return (
        <select
            className="listing-select"
            value={selectedId}
            onChange={handleChange}
            style={{ marginBottom: 12, display: 'block', width: '100%' }}
        >
            {savedPaymentMethods.map((pm) => (
                <option key={pm.id} value={pm.id}>
                    {pm.brand[0].toUpperCase() + pm.brand.slice(1)} •••• {pm.last4}
                </option>
            ))}
            <option value={ADD_NEW_CARD}>+ Add a new card</option>
        </select>
    );
}

function CtaButton({
    session,
    savedPaymentMethods,
}: {
    session: CheckoutSession;
    savedPaymentMethods: PaymentMethod[];
}) {
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState(() => {
        const fromUrl = new URLSearchParams(window.location.search).get('paymentMethodId');
        if (fromUrl && savedPaymentMethods.some((pm) => pm.id === fromUrl)) return fromUrl;
        return savedPaymentMethods[0]?.id ?? '';
    });

    async function acknowledgePrice() {
        setBusy(true);
        setMessage(null);
        try {
            const res = await fetch(`/checkout-sessions/${session.id}/acknowledge-price`, { method: 'POST' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Could not accept new price');
            window.location.reload();
        } catch (err) {
            setMessage(err instanceof Error ? err.message : 'Something went wrong');
            setBusy(false);
        }
    }

    async function completePurchase() {
        setBusy(true);
        setMessage(null);
        try {
            const res = await fetch(`/checkout-sessions/${session.id}/complete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    idempotencyKey: crypto.randomUUID(),
                    paymentMethodId: selectedPaymentMethodId,
                }),
            });
            const data = await res.json();
            // COMPLETION_IN_PROGRESS isn't really an error to show the fan —
            // it means another device is mid-completion, so reload to reflect
            // the real current state (payment_pending, or completed if it
            // finished by the time this reload lands).
            if (!res.ok && data.code !== 'COMPLETION_IN_PROGRESS') {
                throw new Error(data.error || 'Could not complete purchase');
            }
            window.location.reload();
        } catch (err) {
            setMessage(err instanceof Error ? err.message : 'Something went wrong');
            setBusy(false);
        }
    }

    switch (session.status) {
        case 'price_changed':
            return (
                <div>
                    <button className="cta-button" onClick={acknowledgePrice} disabled={busy}>
                        {busy ? 'Accepting…' : 'Accept New Price'}
                    </button>
                    {message && <p className="cta-note">{message}</p>}
                </div>
            );
        case 'expired':
            return (
                <a className="cta-button" href="/">
                    Find Similar Tickets
                </a>
            );
        case 'payment_pending':
            return (
                <button className="cta-button cta-secondary" onClick={() => window.location.reload()}>
                    Check Status
                </button>
            );
        case 'completed':
            return (
                <div>
                    <button className="cta-button" disabled>
                        View Order
                    </button>
                    <p className="cta-note">Order ID: {session.orderId}</p>
                </div>
            );
        case 'completion_failed':
            return (
                <div>
                    <PaymentMethodSelect
                        session={session}
                        savedPaymentMethods={savedPaymentMethods}
                        selectedId={selectedPaymentMethodId}
                        onChange={setSelectedPaymentMethodId}
                    />
                    <button className="cta-button" onClick={completePurchase} disabled={busy}>
                        {busy ? 'Retrying…' : 'Retry Purchase'}
                    </button>
                    {message && <p className="cta-note">{message}</p>}
                </div>
            );
        case 'active':
        default:
            return (
                <div>
                    <PaymentMethodSelect
                        session={session}
                        savedPaymentMethods={savedPaymentMethods}
                        selectedId={selectedPaymentMethodId}
                        onChange={setSelectedPaymentMethodId}
                    />
                    <button className="cta-button" onClick={completePurchase} disabled={busy}>
                        {busy ? 'Completing…' : 'Complete Purchase'}
                    </button>
                    {message && <p className="cta-note">{message}</p>}
                </div>
            );
    }
}

function SelectListing({ listingId, maxQty }: { listingId: string; maxQty: number }) {
    const [qty, setQty] = useState(Math.min(2, maxQty));
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleContinue() {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/checkout-sessions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ listingId, qty }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Could not start checkout');
            window.location.href = `/checkout/${data.session.id}`;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Something went wrong');
            setLoading(false);
        }
    }

    return (
        <div>
            <label htmlFor="qty" style={{ display: 'block', marginBottom: 8, color: '#a3a3a3', fontSize: 14 }}>
                Quantity
            </label>
            <select
                id="qty"
                className="listing-select"
                value={qty}
                onChange={(e) => setQty(Number(e.target.value))}
                style={{ marginBottom: 20, display: 'block' }}
            >
                {Array.from({ length: maxQty }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                        {n}
                    </option>
                ))}
            </select>
            {error && (
                <p className="cta-note" style={{ color: '#f28b8b' }}>
                    {error}
                </p>
            )}
            <button className="cta-button" onClick={handleContinue} disabled={loading}>
                {loading ? 'Starting checkout…' : 'CONTINUE'}
            </button>
        </div>
    );
}

function ListingCard({ listing }: { listing: Listing }) {
    return (
        <a
            className="card"
            style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}
            href={`/listings/${listing.id}`}
        >
            <h2 className="event-title" style={{ fontSize: 20 }}>
                {listing.event.title}
            </h2>
            <p className="event-meta">
                {listing.event.venue} · {listing.event.city}
            </p>
            <p className="price" style={{ fontSize: 28 }}>
                ${listing.price.toFixed(2)}{' '}
                <span style={{ fontSize: 13, color: '#a3a3a3', fontWeight: 400 }}>/ ticket</span>
            </p>
            <p style={{ color: '#a3a3a3', fontSize: 14, margin: 0 }}>{listing.availableQty} tickets left</p>
        </a>
    );
}

function ListingSearch({ initialListings }: { initialListings: Listing[] }) {
    const [query, setQuery] = useState('');
    const [listings, setListings] = useState(initialListings);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Debounced, cancel-on-every-keystroke: a genuine debounce, not just a
    // delay — without clearing the previous timeout, every keystroke would
    // still eventually fire its own request, just later, defeating the
    // point of debouncing at all. An empty query skips the API entirely and
    // reverts to the original full list, matching the default "nothing
    // typed yet" view rather than showing an empty result set.
    useEffect(() => {
        if (!query.trim()) {
            setListings(initialListings);
            setLoading(false);
            setError(null);
            return;
        }

        // clearTimeout only cancels a timer that hasn't fired yet — it can't
        // cancel a fetch already in flight. Without this flag, a slow
        // earlier request that resolves after a faster later one would
        // silently overwrite the newer, more relevant results.
        let cancelled = false;
        setLoading(true);
        setError(null);

        const timeoutId = setTimeout(async () => {
            try {
                const res = await fetch(`/listings/search?q=${encodeURIComponent(query)}`);
                if (!res.ok) throw new Error('Search request failed');
                const data = await res.json();
                if (!cancelled) setListings(data.listings);
            } catch {
                if (!cancelled) setError('Something went wrong searching — please try again.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        }, 300);

        return () => {
            cancelled = true;
            clearTimeout(timeoutId);
        };
    }, [query, initialListings]);

    return (
        <div>
            <input
                className="listing-search"
                type="search"
                placeholder="Search events…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    background: '#0a0a0a',
                    color: '#f5f5f5',
                    border: '1px solid #333',
                    borderRadius: 8,
                    padding: '12px 14px',
                    fontSize: 16,
                    marginBottom: 20,
                }}
            />
            {loading && <p style={{ color: '#a3a3a3', fontSize: 14 }}>Search in progress…</p>}
            {error && <p style={{ color: '#f28b8b', fontSize: 14 }}>{error}</p>}
            {!loading && !error && listings.length === 0 && (
                <p style={{ color: '#a3a3a3', fontSize: 14 }}>No results found.</p>
            )}
            {!loading && !error && listings.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 20 }}>
                    {listings.map((listing) => (
                        <ListingCard key={listing.id} listing={listing} />
                    ))}
                </div>
            )}
        </div>
    );
}

// Same field-level touched/error state and live formatting as the standalone
// checkout form this was ported from, adapted to fetch-then-navigate (this
// app has no client router) instead of a router's navigate.
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

function AddPaymentMethodForm({ sessionId }: { sessionId: string }) {
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
            const res = await fetch(`/checkout-sessions/${sessionId}/payment-methods`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cardholderName: result.data.cardholderName,
                    brand: detectedIssuer.id,
                    last4: result.data.cardNumber.slice(-4),
                    expMonth,
                    expYear: 2000 + expYear,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Could not save card');
            window.location.href = `/checkout/${sessionId}?paymentMethodId=${data.paymentMethod.id}`;
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

            {submitError && <p className="cta-note" style={{ color: '#f28b8b' }}>{submitError}</p>}

            <button type="submit" className="cta-button" disabled={!isFormValid || saving}>
                {saving ? 'Saving…' : 'Save Card'}
            </button>
        </form>
    );
}

const countdownRoot = document.getElementById('countdown-root');
if (countdownRoot) {
    const expiresAt = countdownRoot.dataset.expiresAt!;
    const status = countdownRoot.dataset.status as CheckoutSessionStatus;
    createRoot(countdownRoot).render(<Countdown expiresAt={expiresAt} status={status} />);
}

const ctaRoot = document.getElementById('cta-root');
const sessionDataEl = document.getElementById('session-data');
if (ctaRoot && sessionDataEl) {
    const session: CheckoutSession = JSON.parse(sessionDataEl.textContent || '{}');
    const paymentMethodsDataEl = document.getElementById('payment-methods-data');
    const savedPaymentMethods: PaymentMethod[] = paymentMethodsDataEl
        ? JSON.parse(paymentMethodsDataEl.textContent || '[]')
        : [];
    createRoot(ctaRoot).render(<CtaButton session={session} savedPaymentMethods={savedPaymentMethods} />);
}

const selectRoot = document.getElementById('select-root');
if (selectRoot) {
    const listingId = selectRoot.dataset.listingId!;
    const maxQty = Number(selectRoot.dataset.maxQty);
    createRoot(selectRoot).render(<SelectListing listingId={listingId} maxQty={maxQty} />);
}

const listingSearchRoot = document.getElementById('listing-search-root');
const listingsDataEl = document.getElementById('listings-data');
if (listingSearchRoot && listingsDataEl) {
    const initialListings: Listing[] = JSON.parse(listingsDataEl.textContent || '[]');
    createRoot(listingSearchRoot).render(<ListingSearch initialListings={initialListings} />);
}

const addPaymentMethodRoot = document.getElementById('add-payment-method-root');
if (addPaymentMethodRoot) {
    const sessionId = addPaymentMethodRoot.dataset.sessionId!;
    createRoot(addPaymentMethodRoot).render(<AddPaymentMethodForm sessionId={sessionId} />);
}
