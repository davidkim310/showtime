import { NextRequest } from 'next/server';
import { proxy } from '../proxy';
import { api } from './routeHandler';
import { signResumeToken } from '../src/server/resumeToken';

// Status codes themselves can only be observed against a production build
// (`next start`); dev renders without a streamed shell and reports 404s either
// way. These cover the decision the proxy makes.

const run = (path: string) => proxy(new NextRequest(`http://showtime.test${path}`));
const rewrittenToNotFound = (res: ReturnType<typeof proxy>) =>
    res?.headers.get('x-middleware-rewrite') === 'http://showtime.test/__not-found__';

async function createSession() {
    const res = await api.createSession({ listingId: 'lakers-warriors-112-14', qty: 2 });
    return res.body.session.id as string;
}

describe('proxy', () => {
    test('lets a real session through on every checkout page', async () => {
        const id = await createSession();

        expect(run(`/checkout/${id}`)).toBeUndefined();
        expect(run(`/checkout/${id}/payment-methods/new`)).toBeUndefined();
        expect(run(`/mobile/checkout/${id}?token=${signResumeToken(id)}`)).toBeUndefined();
    });

    test('sends an unknown session to the not-found page', () => {
        expect(rewrittenToNotFound(run('/checkout/no-such-session'))).toBe(true);
        expect(rewrittenToNotFound(run('/checkout/no-such-session/payment-methods/new'))).toBe(true);
    });

    test('sends a mobile deep link with a missing or forged token to the not-found page', async () => {
        const id = await createSession();

        expect(rewrittenToNotFound(run(`/mobile/checkout/${id}`))).toBe(true);
        expect(rewrittenToNotFound(run(`/mobile/checkout/${id}?token=forged.0.deadbeef`))).toBe(true);
        expect(rewrittenToNotFound(run(`/mobile/checkout/no-such-session?token=forged.0.deadbeef`))).toBe(true);
    });

    // The web checkout never had a token; requiring one there would lock buyers out.
    test('does not ask for a token on the web checkout', async () => {
        const id = await createSession();

        expect(run(`/checkout/${id}`)).toBeUndefined();
    });
});
