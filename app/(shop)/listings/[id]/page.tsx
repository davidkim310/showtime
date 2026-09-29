import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getAllListings } from '@/server/services/inventoryService';
import { getCatalogListing } from '../../../lib/catalog';
import { ListingDetails } from '../../../components/ListingDetails';

export async function generateStaticParams() {
    return getAllListings().map((listing) => ({ id: listing.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
    const { id } = await params;
    const listing = await getCatalogListing(id);
    return { title: listing ? `${listing.event.title} — Checkout Continuity` : 'Checkout Continuity' };
}

export default async function SelectListingPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const listing = await getCatalogListing(id);
    if (!listing) notFound();

    return (
        <main style={{ gridTemplateColumns: '1fr', maxWidth: 560 }}>
            <ListingDetails listing={listing} />
        </main>
    );
}
