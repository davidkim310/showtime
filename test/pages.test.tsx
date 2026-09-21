import { prerenderToNodeStream } from 'react-dom/static';
import type { ReactNode } from 'react';

// Client Components call useRouter() while rendering; outside a Next runtime
// there is no App Router context and the real hook throws. Everything else
// in next/navigation — notFound() in particular — stays real.
jest.mock('next/navigation', () => ({
    ...jest.requireActual('next/navigation'),
    useRouter: () => ({ push: jest.fn(), replace: jest.fn(), refresh: jest.fn(), back: jest.fn(), prefetch: jest.fn() }),
}));

// cacheLife()/cacheTag() throw unless Next's compiler put them inside a
// "use cache" scope. Under Jest the directive is inert, so cached functions
// simply run every time — the tests see the real read, uncached.
jest.mock('next/cache', () => ({
    ...jest.requireActual('next/cache'),
    cacheLife: jest.fn(),
    cacheTag: jest.fn(),
}));

import BrowsePage from '../app/page';
import SelectListingPage from '../app/listings/[id]/page';
import CheckoutPage from '../app/checkout/[id]/page';
import AddPaymentMethodPage from '../app/checkout/[id]/payment-methods/new/page';
import MobileCheckoutPage from '../app/mobile/checkout/[id]/page';
import { api } from './routeHandler';
import { getAllListings, getListing, setListingPrice, resetListing } from '../src/server/services/inventoryService';
import { resetPaymentResult } from '../src/server/services/paymentService';
import { signResumeToken } from '../src/server/resumeToken';

const LISTING_ID = 'lakers-warriors-112-14';
const NOT_FOUND = { digest: 'NEXT_HTTP_ERROR_FALLBACK;404' };

// A page is an async function that returns an element tree. Prerendering that
// tree waits for every <Suspense> boundary to resolve — async children
// included — so the result is the complete HTML a browser ends up with: the
// Server Components' real data access and side effects, plus the Client
// Components' initial render. Effects never run.
async function render(page: ReactNode | Promise<ReactNode>): Promise<string> {
    // An error inside a <Suspense> boundary doesn't reject the prerender —
    // React renders the fallback and moves on — so collect and rethrow it.
    const errors: unknown[] = [];
    const { prelude } = await prerenderToNodeStream(await page, { onError: (error) => void errors.push(error) });
    let html = '';
    for await (const chunk of prelude) html += chunk;
    if (errors.length > 0) throw errors[0];
    // Hydration markers (<!-- --> between adjacent text nodes, <!--$--> around
    // Suspense content) would split strings like "3 tickets left" apart.
    return html.replace(/<!--.*?-->/g, '');
}

const params = (id: string) => Promise.resolve({ id });
const search = (query: Record<string, string | undefined> = {}) => Promise.resolve(query);

async function createSession(qty = 2) {
    const res = await api.createSession({ listingId: LISTING_ID, qty });
    return res.body.session;
}

function optionTag(markup: string, value: string): string {
    const match = markup.match(new RegExp(`<option[^>]*value="${value}"[^>]*>`));
    if (!match) throw new Error(`no <option value="${value}"> in markup`);
    return match[0];
}

afterEach(() => {
    resetListing(LISTING_ID);
    resetPaymentResult();
});

describe('/ (browse)', () => {
    test('renders every listing, each linking to its own page', async () => {
        const markup = await render(BrowsePage());

        expect(markup).toContain('placeholder="Search events…"');
        for (const listing of getAllListings()) {
            expect(markup).toContain(listing.event.title);
            expect(markup).toContain(`href="/listings/${listing.id}"`);
        }
    });
});

describe('/listings/[id]', () => {
    test('an unknown listing is not found', async () => {
        await expect(SelectListingPage({ params: params('no-such-listing') })).rejects.toMatchObject(NOT_FOUND);
    });

    test('renders the listing with a quantity selector bounded by availability', async () => {
        const listing = getListing(LISTING_ID)!;

        const markup = await render(SelectListingPage({ params: params(LISTING_ID) }));

        expect(markup).toContain(listing.event.title);
        expect(markup).toContain(`${listing.availableQty} tickets left`);
        expect(markup).toContain('CONTINUE');
        expect(markup.match(/<option/g)).toHaveLength(listing.availableQty);
    });
});

describe('/checkout/[id]', () => {
    test('an unknown session is not found', async () => {
        await expect(CheckoutPage({ params: params('no-such-session'), searchParams: search() })).rejects.toMatchObject(
            NOT_FOUND,
        );
    });

    test('rendering is a resume: it stamps the web surface and shows the live total', async () => {
        const session = await createSession(2);

        const markup = await render(CheckoutPage({ params: params(session.id), searchParams: search() }));

        expect(markup).toContain('Ready to complete your purchase.');
        expect(markup).toContain('Complete Purchase');
        expect(markup).toContain(session.event.title);
        expect(markup).toContain(`$${(session.currentPrice * 2).toFixed(2)}`);

        const after = (await api.getSession(session.id)).body.session;
        expect(after.lastResumedSurface).toBe('web');
        expect(after.version).toBeGreaterThan(session.version);
    });

    test('a price change is detected by the next render and switches the CTA to acknowledge', async () => {
        const session = await createSession();
        setListingPrice(LISTING_ID, 199);

        const markup = await render(CheckoutPage({ params: params(session.id), searchParams: search() }));

        expect(markup).toContain('Price changed since you started checkout.');
        expect(markup).toContain('Accept New Price');
        expect(markup).toContain('class="price-old">$145.00');
        expect(markup).toContain('$199.00');
        expect(markup).not.toContain('Complete Purchase');
    });

    test('preselects the saved card named in the query string, else the first saved card', async () => {
        const session = await createSession();

        const named = await render(
            CheckoutPage({ params: params(session.id), searchParams: search({ paymentMethodId: 'pm-seed-mastercard' }) }),
        );
        expect(optionTag(named, 'pm-seed-mastercard')).toContain('selected');
        expect(optionTag(named, 'pm-seed-visa')).not.toContain('selected');

        const unknown = await render(
            CheckoutPage({ params: params(session.id), searchParams: search({ paymentMethodId: 'pm-not-real' }) }),
        );
        expect(optionTag(unknown, 'pm-seed-visa')).toContain('selected');
    });

    test('after completion it shows the order and the card it was paid with', async () => {
        const session = await createSession();
        const completed = await api.complete(session.id, { idempotencyKey: 'k1', paymentMethodId: 'pm-seed-visa' });

        const markup = await render(CheckoutPage({ params: params(session.id), searchParams: search() }));

        expect(markup).toContain('Order complete!');
        expect(markup).toContain('View Order');
        expect(markup).toContain(`Order ID: ${completed.body.session.orderId}`);
        expect(markup).toContain('Paid with visa •••• 4242');
    });
});

describe('/checkout/[id]/payment-methods/new', () => {
    test('an unknown session is not found', async () => {
        await expect(AddPaymentMethodPage({ params: params('no-such-session') })).rejects.toMatchObject(NOT_FOUND);
    });

    test('renders the form with saving disabled until the card is valid, and a way back', async () => {
        const session = await createSession();

        const markup = await render(AddPaymentMethodPage({ params: params(session.id) }));

        expect(markup).toContain('Add a card');
        expect(markup).toMatch(/<button[^>]*disabled[^>]*>Save Card<\/button>/);
        expect(markup).toContain(`href="/checkout/${session.id}"`);
    });
});

describe('/mobile/checkout/[id]', () => {
    test('an active session gets the CTA bar; a recovery state gets the bottom sheet', async () => {
        const session = await createSession();
        const token = signResumeToken(session.id);
        const open = () => MobileCheckoutPage({ params: params(session.id), searchParams: search({ token }) });

        const active = await render(open());
        expect(active).toContain('Opened from mobile deep link');
        expect(active).toContain('class="phone-cta-bar"');
        expect(active).not.toContain('bottom-sheet');

        setListingPrice(LISTING_ID, 199);

        const recovery = await render(open());
        expect(recovery).toContain('class="bottom-sheet"');
        expect(recovery).toContain('tone-warning');
        expect(recovery).toContain('Accept New Price');
    });
});
