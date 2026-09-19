import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSession } from '@/server/services/sessionStore';
import { SiteHeader } from '../../../../components/SiteHeader';
import { AddPaymentMethodForm } from '../../../../components/AddPaymentMethodForm';

// Reads params before rendering anything, so there is no shell to stream yet: allowed to block.
export const instant = false;

export const metadata: Metadata = { title: 'Add a card — Checkout Continuity' };

export default async function AddPaymentMethodPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const session = getSession(id);
    if (!session) notFound();

    return (
        <>
            <SiteHeader />
            <main style={{ gridTemplateColumns: '1fr', maxWidth: 480 }}>
                <div className="card">
                    <h1 className="checkout-title" style={{ fontSize: 22, margin: '0 0 20px' }}>
                        Add a card
                    </h1>
                    <AddPaymentMethodForm sessionId={session.id} />
                    <Link className="view-on-mobile" href={`/checkout/${session.id}`}>
                        ← Back to checkout
                    </Link>
                </div>
            </main>
        </>
    );
}
