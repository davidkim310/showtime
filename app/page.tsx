import { getAllListings } from '@/server/services/inventoryService';
import { SiteHeader } from './components/SiteHeader';
import { ListingSearch } from './components/ListingSearch';

// Inventory is live state — prices and availability change underneath us
// (the debug routes mutate them today, a real inventory service will later).
// Without this the route is prerendered at build time and serves a snapshot.
export const dynamic = 'force-dynamic';

export default function BrowsePage() {
    const listings = getAllListings();

    return (
        <>
            <SiteHeader />
            <main style={{ gridTemplateColumns: '1fr', maxWidth: 960 }}>
                <ListingSearch initialListings={listings} />
            </main>
        </>
    );
}
