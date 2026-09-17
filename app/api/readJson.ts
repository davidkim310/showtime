// express.json() leaves req.body as {} when a request has no body;
// request.json() throws instead. Route handlers replacing Express routes
// need the tolerant behavior, since callers like the acknowledge-price
// button POST with no body at all.
export async function readJson(request: Request): Promise<any> {
    try {
        return await request.json();
    } catch {
        return {};
    }
}
