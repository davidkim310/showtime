import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/server/services/sessionStore';
import { verifyResumeToken } from '@/server/resumeToken';

// Checkout pages stream, so by the time a page calls notFound() the response
// is already committed to 200. Rejecting here, before anything is sent, lets a
// missing session or bad deep-link token get a real 404.
//
// This is an optimistic check only. The pages repeat both checks and stay the
// authority: deleting this file changes status codes, never who gets in.
//
// It reads the in-memory session store, which only works because proxy runs in
// the same process as the pages under `next start`. A host that ran proxy
// separately would see no sessions and 404 every checkout — until sessions move
// to a shared store.
export const config = { matcher: ['/checkout/:id/:path*', '/mobile/checkout/:id'] };

export function proxy(request: NextRequest) {
    const segments = request.nextUrl.pathname.split('/').filter(Boolean);
    const isMobile = segments[0] === 'mobile';
    const id = isMobile ? segments[2] : segments[1];

    const token = request.nextUrl.searchParams.get('token') ?? undefined;
    const allowed = getSession(id) !== undefined && (!isMobile || verifyResumeToken(token, id));

    // A path no route matches, so Next serves the not-found page with a real 404.
    if (!allowed) return NextResponse.rewrite(new URL('/__not-found__', request.url));
}
