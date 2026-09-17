import { api } from './routeHandler';
import { searchListings, getAllListings } from '../src/server/services/inventoryService';

describe('searchListings()', () => {
    test('returns every listing for an empty query', () => {
        expect(searchListings('')).toEqual(getAllListings());
    });

    test('returns every listing for a whitespace-only query', () => {
        expect(searchListings('   ')).toEqual(getAllListings());
    });

    test('matches case-insensitively', () => {
        const results = searchListings('LAKERS');

        expect(results.length).toBeGreaterThan(0);
        expect(results.every((listing) => listing.event.title.toLowerCase().includes('lakers'))).toBe(true);
    });

    test('matches a substring anywhere in the title', () => {
        const results = searchListings('vs.');

        expect(results).toEqual(getAllListings());
    });

    test('returns an empty array when nothing matches', () => {
        expect(searchListings('zzz-no-such-event')).toEqual([]);
    });
});

// The old Express suite also asserted that /listings/search wasn't shadowed
// by the /listings/:id route, which depended on registration order. That
// hazard no longer exists: in the App Router the search endpoint lives at a
// static segment (app/api/listings/search/route.ts) that resolves ahead of
// any dynamic [id] sibling, and `next build` is what verifies the file tree
// maps to distinct URLs — a direct handler call can't observe routing at all.
describe('GET /api/listings/search', () => {
    test('returns every listing when q is omitted', async () => {
        const res = await api.search();

        expect(res.status).toBe(200);
        expect(res.body.listings).toEqual(getAllListings());
    });

    test('returns every listing when q is empty', async () => {
        const res = await api.search('');

        expect(res.status).toBe(200);
        expect(res.body.listings).toEqual(getAllListings());
    });

    test('filters case-insensitively by title', async () => {
        const res = await api.search('dodgers');

        expect(res.status).toBe(200);
        expect(res.body.listings.length).toBeGreaterThan(0);
        expect(
            (res.body.listings as { event: { title: string } }[]).every((listing) =>
                listing.event.title.toLowerCase().includes('dodgers')
            )
        ).toBe(true);
    });

    test('returns an empty array when nothing matches', async () => {
        const res = await api.search('zzz-no-such-event');

        expect(res.status).toBe(200);
        expect(res.body.listings).toEqual([]);
    });
});
