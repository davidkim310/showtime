import * as createSessionRoute from '../app/api/checkout-sessions/route';
import * as sessionRoute from '../app/api/checkout-sessions/[id]/route';
import * as resumeRoute from '../app/api/checkout-sessions/[id]/resume/route';
import * as acknowledgeRoute from '../app/api/checkout-sessions/[id]/acknowledge-price/route';
import * as completeRoute from '../app/api/checkout-sessions/[id]/complete/route';
import * as paymentMethodsRoute from '../app/api/checkout-sessions/[id]/payment-methods/route';
import * as searchRoute from '../app/api/listings/search/route';

type Params = Record<string, string>;
type Handler<P extends Params> = (request: Request, context: { params: Promise<P> }) => Promise<Response>;

// Invokes a Route Handler the way Next.js would — a Web Request in, a Web
// Response out — without a server. Next's router is bypassed entirely, so
// `params` has to be supplied by hand and a mis-nested route folder can't be
// caught here; `next build` is what verifies the file tree maps to the URLs.
export async function call<P extends Params>(
    handler: Handler<P>,
    { method = 'GET', path, params, body }: { method?: string; path: string; params?: P; body?: unknown },
): Promise<{ status: number; body: any }> {
    const init: RequestInit = { method };
    if (body !== undefined) {
        init.body = JSON.stringify(body);
        init.headers = { 'Content-Type': 'application/json' };
    }

    const response = await handler(new Request(`http://showtime.test${path}`, init), {
        params: Promise.resolve(params ?? ({} as P)),
    });

    return { status: response.status, body: await response.json() };
}

export const api = {
    createSession: (body: unknown) =>
        call(createSessionRoute.POST, { method: 'POST', path: '/api/checkout-sessions', body }),

    getSession: (id: string) =>
        call(sessionRoute.GET, { path: `/api/checkout-sessions/${id}`, params: { id } }),

    resume: (id: string, body: unknown) =>
        call(resumeRoute.POST, { method: 'POST', path: `/api/checkout-sessions/${id}/resume`, params: { id }, body }),

    acknowledgePrice: (id: string) =>
        call(acknowledgeRoute.POST, {
            method: 'POST',
            path: `/api/checkout-sessions/${id}/acknowledge-price`,
            params: { id },
        }),

    complete: (id: string, body: unknown) =>
        call(completeRoute.POST, { method: 'POST', path: `/api/checkout-sessions/${id}/complete`, params: { id }, body }),

    addPaymentMethod: (id: string, body: unknown) =>
        call(paymentMethodsRoute.POST, {
            method: 'POST',
            path: `/api/checkout-sessions/${id}/payment-methods`,
            params: { id },
            body,
        }),

    search: (q?: string) =>
        call(searchRoute.GET, { path: q === undefined ? '/api/listings/search' : `/api/listings/search?q=${encodeURIComponent(q)}` }),
};
