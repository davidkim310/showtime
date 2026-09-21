import { revalidateTag } from 'next/cache';
import { call } from './routeHandler';
import * as priceRoute from '../app/api/debug/listings/[id]/price/route';
import * as soldOutRoute from '../app/api/debug/listings/[id]/sold-out/route';
import * as resetRoute from '../app/api/debug/listings/[id]/reset/route';
import { listingTag } from '../app/lib/catalog';
import { getListing, resetListing } from '../src/server/services/inventoryService';

// revalidateTag() needs a Next request in scope; here it only needs to be observed.
jest.mock('next/cache', () => ({
    ...jest.requireActual('next/cache'),
    revalidateTag: jest.fn(),
}));

const LISTING_ID = 'lakers-warriors-112-14';

afterEach(() => {
    resetListing(LISTING_ID);
    jest.mocked(revalidateTag).mockClear();
});

// The catalog and listing pages are cached; a route that changes inventory
// without invalidating the listing's tag leaves them showing the old values.
describe('debug routes that change inventory invalidate that listing', () => {
    test.each([
        {
            name: 'price',
            handler: priceRoute.POST,
            body: { price: 199 },
            applied: () => expect(getListing(LISTING_ID)!.price).toBe(199),
        },
        {
            name: 'sold-out',
            handler: soldOutRoute.POST,
            body: undefined,
            applied: () => expect(getListing(LISTING_ID)!.availableQty).toBe(0),
        },
        {
            name: 'reset',
            handler: resetRoute.POST,
            body: undefined,
            applied: () => expect(getListing(LISTING_ID)!.price).toBe(145),
        },
    ])('$name', async ({ name, handler, body, applied }) => {
        const res = await call(handler, {
            method: 'POST',
            path: `/api/debug/listings/${LISTING_ID}/${name}`,
            params: { id: LISTING_ID },
            body,
        });

        expect(res.status).toBe(200);
        applied();
        expect(revalidateTag).toHaveBeenCalledTimes(1);
        expect(revalidateTag).toHaveBeenCalledWith(listingTag(LISTING_ID), { expire: 0 });
    });
});
