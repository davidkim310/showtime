import request from 'supertest';
import app from '../src/server/app';
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

describe('GET /listings/search', () => {
    test('returns every listing when q is omitted', async () => {
        const res = await request(app).get('/listings/search');

        expect(res.status).toBe(200);
        expect(res.body.listings).toEqual(getAllListings());
    });

    test('returns every listing when q is empty', async () => {
        const res = await request(app).get('/listings/search').query({ q: '' });

        expect(res.status).toBe(200);
        expect(res.body.listings).toEqual(getAllListings());
    });

    test('filters case-insensitively by title', async () => {
        const res = await request(app).get('/listings/search').query({ q: 'dodgers' });

        expect(res.status).toBe(200);
        expect(res.body.listings.length).toBeGreaterThan(0);
        expect(
            (res.body.listings as { event: { title: string } }[]).every((listing) =>
                listing.event.title.toLowerCase().includes('dodgers')
            )
        ).toBe(true);
    });

    test('returns an empty array when nothing matches', async () => {
        const res = await request(app).get('/listings/search').query({ q: 'zzz-no-such-event' });

        expect(res.status).toBe(200);
        expect(res.body.listings).toEqual([]);
    });

    test('is not shadowed by the /listings/:id route', async () => {
        const res = await request(app).get('/listings/search');

        // A regression here would make Express treat "search" as an :id
        // value and 404 through the single-listing lookup instead.
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.listings)).toBe(true);
    });
});
