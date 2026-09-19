import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getListing } from '@/server/services/inventoryService';
import { SiteHeader } from '../../components/SiteHeader';
import { SelectListing } from '../../components/SelectListing';

// Reads params before rendering anything, so there is no shell to stream yet: allowed to block.
export const instant = false;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
    const { id } = await params;
    const listing = getListing(id);
    return { title: listing ? `${listing.event.title} — Checkout Continuity` : 'Checkout Continuity' };
}

export default async function SelectListingPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const listing = getListing(id);
    if (!listing) notFound();

    return (
        <>
            <SiteHeader />
            <main style={{ gridTemplateColumns: '1fr', maxWidth: 560 }}>
                <div className="card">
                    <h1 className="event-title">{listing.event.title}</h1>
                    <p className="event-meta">
                        {listing.event.venue} · {listing.event.city}
                    </p>
                    <div className="badge">Section {listing.section}</div>
                    <div className="badge">Row {listing.row}</div>
                    <div className="badge">Mobile Transfer Ticket</div>
                    <div className="badge">Best Price Guarantee</div>
                    <p className="price">
                        ${listing.price.toFixed(2)}{' '}
                        <span style={{ fontSize: 14, color: '#a3a3a3', fontWeight: 400 }}>/ ticket, incl. fees</span>
                    </p>
                    <p style={{ color: '#a3a3a3', fontSize: 14 }}>{listing.availableQty} tickets left</p>
                    <SelectListing listingId={listing.id} maxQty={listing.availableQty} />
                </div>
            </main>
        </>
    );
}
