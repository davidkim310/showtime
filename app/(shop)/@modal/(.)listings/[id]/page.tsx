import { notFound } from 'next/navigation';
import { getAllListings } from '@/server/services/inventoryService';
import { getCatalogListing } from '../../../../lib/catalog';
import { ListingDetails } from '../../../../components/ListingDetails';
import { Modal } from '../../../../components/Modal';

// "(.)listings" intercepts /listings/[id] during client-side navigation from
// within (shop), so clicking a listing on the browse page opens it here, over
// the page. A direct visit or a refresh skips the interception and renders the
// full page at app/(shop)/listings/[id] instead. The "(.)" counts route
// segments, not folders: neither "(shop)" nor "@modal" is a segment.
// Same reason as the full listing page: without known ids, reading params
// blocks prerendering. Each listing's modal is prebuilt from the cached catalog.
export async function generateStaticParams() {
    return getAllListings().map((listing) => ({ id: listing.id }));
}

export default async function ListingModal({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const listing = await getCatalogListing(id);
    if (!listing) notFound();

    return (
        <Modal label={listing.event.title}>
            <ListingDetails listing={listing} />
        </Modal>
    );
}
