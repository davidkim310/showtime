import { Suspense } from 'react';
import { connection } from 'next/server';
import { getAllListings } from '@/server/services/inventoryService';
import { SiteHeader } from './components/SiteHeader';
import { ListingSearch } from './components/ListingSearch';

// Inventory is live, but the in-memory read is synchronous, so without
// connection() Next would bake it into the build-time shell like a constant.
async function Listings() {
    await connection();
    return <ListingSearch initialListings={getAllListings()} />;
}

export default function BrowsePage() {
    return (
        <>
            <SiteHeader />
            <main style={{ gridTemplateColumns: '1fr', maxWidth: 960 }}>
                <Suspense fallback={<p style={{ color: '#a3a3a3', fontSize: 14 }}>Loading events…</p>}>
                    <Listings />
                </Suspense>
            </main>
        </>
    );
}
