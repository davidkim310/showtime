import { getCatalog } from '../lib/catalog';
import { ListingSearch } from '../components/ListingSearch';

export default async function BrowsePage() {
    const listings = await getCatalog();

    return (
        <main style={{ gridTemplateColumns: '1fr', maxWidth: 960 }}>
            <ListingSearch initialListings={listings} />
        </main>
    );
}
