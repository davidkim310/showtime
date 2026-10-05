// Next calls register() once when a server starts, before it takes any request.
// Checking production config here fails the deploy rather than a buyer's first
// checkout. resumeToken uses node:crypto, so it's only imported on Node.
export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        const { getResumeTokenSecret } = await import('@/server/resumeToken');
        try {
            getResumeTokenSecret();
        } catch (error) {
            // Next catches a throw from register() and keeps the process up,
            // answering every request with a 500 — which looks alive to anything
            // that only checks the process. Exit so the deploy itself fails.
            console.error(error instanceof Error ? error.message : error);
            process.exit(1);
        }
    }
}
