import { persistent } from './moduleState';

export type Listing = {
    id: string;
    event: { title: string; venue: string; city: string; startsAt: string };
    section: string;
    row: string;
    price: number;
    availableQty: number;
};

const listings = persistent('__showtime_listings', () => new Map<string, Listing>([
    [
        'lakers-warriors-112-14',
        {
            id: 'lakers-warriors-112-14',
            event: {
                title: 'Lakers vs. Warriors',
                venue: 'Crypto.com Arena',
                city: 'Los Angeles, CA',
                startsAt: '2026-08-01T19:30:00.000Z',
            },
            section: '112',
            row: '14',
            price: 145,
            availableQty: 4,
        },
    ],
    [
        'dodgers-padres-104-4',
        {
            id: 'dodgers-padres-104-4',
            event: {
                title: 'Dodgers vs. Padres',
                venue: 'Dodger Stadium',
                city: 'Los Angeles, CA',
                startsAt: '2026-08-15T19:00:00.000Z',
            },
            section: '104',
            row: '4',
            price: 85,
            availableQty: 6,
        },
    ],
    [
        'lakers-warriors-112-14-2',
        {
            id: 'lakers-warriors-112-14-2',
            event: {
                title: 'Lakers vs. Warriors - 2',
                venue: 'Crypto.com Arena',
                city: 'Los Angeles, CA',
                startsAt: '2026-09-12T19:30:00.000Z',
            },
            section: '112',
            row: '14',
            price: 160,
            availableQty: 3,
        },
    ],
    [
        'lakers-warriors-112-14-3',
        {
            id: 'lakers-warriors-112-14-3',
            event: {
                title: 'Lakers vs. Warriors - 3',
                venue: 'Crypto.com Arena',
                city: 'Los Angeles, CA',
                startsAt: '2026-10-01T19:30:00.000Z',
            },
            section: '112',
            row: '14',
            price: 175,
            availableQty: 7,
        },
    ],
    [
        'dodgers-padres-104-4-2',
        {
            id: 'dodgers-padres-104-4-2',
            event: {
                title: 'Dodgers vs. Padres - 2',
                venue: 'Dodger Stadium',
                city: 'Los Angeles, CA',
                startsAt: '2026-09-01T19:00:00.000Z',
            },
            section: '104',
            row: '4',
            price: 92,
            availableQty: 5,
        },
    ],
]));

export function getListing(listingId: string): Listing | undefined {
    return listings.get(listingId);
}

export function getAllListings(): Listing[] {
    return Array.from(listings.values());
}

// Case-insensitive substring match against the event title. An empty/blank
// query returns every listing, matching the "no query yet" default view on
// the browse page rather than an empty result set.
export function searchListings(query: string): Listing[] {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
        return getAllListings();
    }
    return getAllListings().filter((listing) => listing.event.title.toLowerCase().includes(normalized));
}

export function setListingPrice(listingId: string, newPrice: number): void {
    const listing = listings.get(listingId);
    if (listing) {
        listing.price = newPrice;
    }
}

export function markListingSoldOut(listingId: string): void {
    const listing = listings.get(listingId);
    if (listing) {
        listing.availableQty = 0;
    }
}

const SEEDS: Record<string, { price: number; availableQty: number }> = {
    'lakers-warriors-112-14': { price: 145, availableQty: 4 },
    'dodgers-padres-104-4': { price: 85, availableQty: 6 },
    'lakers-warriors-112-14-2': { price: 160, availableQty: 3 },
    'lakers-warriors-112-14-3': { price: 175, availableQty: 7 },
    'dodgers-padres-104-4-2': { price: 92, availableQty: 5 },
};

// Restores a stub listing to its own original seeded values — used by the
// /debug routes in app.ts so manual testing doesn't require restarting the
// dev server between price-change/sold-out scenarios. Keyed per listing
// (rather than one shared constant) since each listing has different seed
// values — a single shared price/qty would silently reset every listing to
// the same wrong numbers once there was more than one.
export function resetListing(listingId: string): void {
    const listing = listings.get(listingId);
    const seed = SEEDS[listingId];
    if (listing && seed) {
        listing.price = seed.price;
        listing.availableQty = seed.availableQty;
    }
}
