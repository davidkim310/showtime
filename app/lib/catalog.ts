import { cacheLife, cacheTag, revalidateTag } from 'next/cache';
import { getAllListings, getListing } from '@/server/services/inventoryService';

// Display-only cached reads. Anything that decides what a buyer is charged —
// session creation, completion — reads inventoryService directly, never this.

export const listingTag = (id: string) => `listing:${id}`;

export async function getCatalog() {
    'use cache';
    cacheLife('hours');
    const listings = getAllListings();
    // Tagged per listing as well, so invalidating one listing also refreshes
    // every page that shows the full catalog.
    cacheTag('listings', ...listings.map((listing) => listingTag(listing.id)));
    return listings;
}

export async function getCatalogListing(id: string) {
    'use cache';
    cacheLife('hours');
    cacheTag(listingTag(id));
    return getListing(id);
}

// For callers that change inventory outside a Server Action, where updateTag
// isn't available. expire: 0 means the next visitor waits for a fresh render
// rather than seeing the old price once more while it refreshes.
export function invalidateListing(id: string) {
    revalidateTag(listingTag(id), { expire: 0 });
}
