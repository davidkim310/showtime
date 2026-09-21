import { getCatalog } from './lib/catalog';
import { SiteHeader } from './components/SiteHeader';
import { ListingSearch } from './components/ListingSearch';

export default async function BrowsePage() {
    const listings = await getCatalog();

    return (
        <>
            <SiteHeader />
            <main style={{ gridTemplateColumns: '1fr', maxWidth: 960 }}>
                <ListingSearch initialListings={listings} />
            </main>
        </>
    );
}
