// The debug routes are manual-testing scaffolding for triggering price
// changes, sold-out inventory and payment failures by hand. Express gated
// them by not registering the routes at all in production; a Route Handler
// file is always routable, so the gate moves inside the handler.
export function blockedInProduction(): Response | null {
    if (process.env.NODE_ENV === 'production') {
        return Response.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 });
    }
    return null;
}
