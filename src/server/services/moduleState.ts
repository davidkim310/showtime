// Next.js bundles Server Components and Route Handlers into separate module
// graphs, so a plain module-level `const store = new Map()` is instantiated
// once per graph: a write through a Route Handler is invisible to a page
// rendering in the very same process. Dev hot-reloading drops it too.
//
// Pinning these stubs to globalThis keeps one instance per process. It is a
// development-time stopgap — none of this survives a restart or a second
// instance, which is what a real store is for.
export function persistent<T>(key: string, create: () => T): T {
    const store = globalThis as unknown as Record<string, T | undefined>;
    const existing = store[key];
    if (existing !== undefined) return existing;

    const created = create();
    store[key] = created;
    return created;
}
