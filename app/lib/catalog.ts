import { cacheLife, cacheTag } from 'next/cache';
import { getAllListings, getListing } from '@/server/services/inventoryService';

// Display-only cached reads. Anything that decides what a fan is charged —
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
