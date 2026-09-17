import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getSession } from '@/server/services/sessionStore';
import { resumeSession } from '@/server/services/checkoutService';
import { getSavedPaymentMethods, getPaymentMethod } from '@/server/services/paymentMethodsService';
import { signResumeToken } from '@/server/resumeToken';
import { SiteHeader } from '../../components/SiteHeader';
import { Countdown } from '../../components/Countdown';
import { CtaButton } from '../../components/CtaButton';
import { statusMessage } from '../../components/statusMessage';

// Never cache: this page reflects live session state, and rendering it IS a
// resume action. A cached render would silently skip that and show a stale
// price or an expired hold as still active.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Checkout' };

export default async function CheckoutPage({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ paymentMethodId?: string }>;
}) {
    const { id } = await params;
    const session = getSession(id);
    if (!session) notFound();

    resumeSession(session, 'web');

    const savedPaymentMethods = getSavedPaymentMethods();
    const { paymentMethodId } = await searchParams;
    const initialPaymentMethodId = savedPaymentMethods.some((pm) => pm.id === paymentMethodId)
        ? paymentMethodId
        : undefined;

    const paidWith = getPaymentMethod(session.paymentMethodId);
    const total = (session.currentPrice * session.listing.qty).toFixed(2);

    return (
        <>
            <SiteHeader title="🛡 Checkout" />
            <main>
                <section>
                    <div className={`banner banner-${session.status}`}>{statusMessage(session)}</div>
                    <div id="countdown-root">
                        <Countdown expiresAt={session.expiresAt} status={session.status} />
                    </div>
                    {session.status === 'price_changed' ? (
                        <p className="price">
                            <span className="price-old">${session.priceAtHold.toFixed(2)}</span>$
                            {session.currentPrice.toFixed(2)}
                        </p>
                    ) : (
                        <p className="price">${session.currentPrice.toFixed(2)}</p>
                    )}
                    <div className="sticky-cta">
                        <div className="inner">
                            <CtaButton
                                session={session}
                                savedPaymentMethods={savedPaymentMethods}
                                initialPaymentMethodId={initialPaymentMethodId}
                                paidWithLabel={
                                    paidWith ? `Paid with ${paidWith.brand} •••• ${paidWith.last4}` : undefined
                                }
                            />
                        </div>
                    </div>
                </section>
                <aside className="card">
                    <h2 className="event-title" style={{ fontSize: 18 }}>
                        {session.event.title}
                    </h2>
                    <p className="event-meta">{new Date(session.event.startsAt).toLocaleString()}</p>
                    <div className="summary-row">
                        <span>Venue</span>
                        <span>
                            {session.event.venue}, {session.event.city}
                        </span>
                    </div>
                    <div className="summary-row">
                        <span>Section / Row</span>
                        <span>
                            {session.listing.section} / {session.listing.row}
                        </span>
                    </div>
                    <div className="summary-row">
                        <span>{session.listing.qty} Seats Together</span>
                        <span>Mobile Transfer Ticket</span>
                    </div>
                    <div className="summary-row summary-total">
                        <span>Total</span>
                        <span>${total}</span>
                    </div>
                    <a
                        className="view-on-mobile"
                        href={`/mobile/checkout/${session.id}?token=${signResumeToken(session.id)}`}
                    >
                        Continue on mobile →
                    </a>
                </aside>
            </main>
        </>
    );
}
