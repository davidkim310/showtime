import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getSession } from '@/server/services/sessionStore';
import { resumeSession } from '@/server/services/checkoutService';
import { getSavedPaymentMethods } from '@/server/services/paymentMethodsService';
import { verifyResumeToken } from '@/server/resumeToken';
import { Countdown } from '../../../components/Countdown';
import { CtaButton } from '../../../components/CtaButton';
import { statusMessage, STATUS_TONE } from '../../../components/statusMessage';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Checkout (Mobile)' };

// Mobile deep-link surface. Same session data and same interactive components
// as the desktop checkout page (Countdown/CtaButton don't know or care which
// shell they're rendered into) — only the markup/CSS differ, simulating a
// phone viewport. Recovery states (anything but "active") render as a bottom
// sheet instead of desktop's top banner.
export default async function MobileCheckoutPage({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ token?: string }>;
}) {
    const { id } = await params;
    const session = getSession(id);
    if (!session) notFound();

    // Authoritative check, deliberately here rather than in middleware: it
    // sits directly above the work it protects, so no routing or matcher
    // change can separate the two. notFound() rather than a 403 so an
    // attacker holding a bare session id learns nothing about whether it
    // names a real session.
    const { token } = await searchParams;
    if (!verifyResumeToken(token, session.id)) notFound();

    resumeSession(session, 'mobile');

    const total = (session.currentPrice * session.listing.qty).toFixed(2);
    const needsRecovery = session.status !== 'active';
    const tone = STATUS_TONE[session.status];

    const cta = (
        <CtaButton session={session} savedPaymentMethods={getSavedPaymentMethods()} />
    );

    return (
        <div className="phone-frame">
            <div className="phone-statusbar">Opened from mobile deep link</div>
            <div className="phone-content">
                <span className={`status-pill status-pill-${session.status}`}>{statusMessage(session)}</span>
                <h1 className="event-title" style={{ fontSize: 20 }}>
                    {session.event.title}
                </h1>
                <p className="event-meta">
                    {session.event.venue} · {new Date(session.event.startsAt).toLocaleDateString()}
                </p>
                <div className="summary-row">
                    <span>Section / Row</span>
                    <span>
                        {session.listing.section} / {session.listing.row}
                    </span>
                </div>
                <div className="summary-row">
                    <span>{session.listing.qty} Seats Together</span>
                    <span>Mobile Transfer</span>
                </div>
                <div className="summary-row summary-total">
                    <span>Total</span>
                    <span>${total}</span>
                </div>
                <div id="countdown-root" style={{ marginTop: 16 }}>
                    <Countdown expiresAt={session.expiresAt} status={session.status} />
                </div>
            </div>
            {needsRecovery ? (
                <div className="bottom-sheet">
                    <div className="bottom-sheet-handle" />
                    <p className={`bottom-sheet-message${tone ? ` tone-${tone}` : ''}`}>{statusMessage(session)}</p>
                    {cta}
                </div>
            ) : (
                <div className="phone-cta-bar">{cta}</div>
            )}
        </div>
    );
}
