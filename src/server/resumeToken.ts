import { createHmac, timingSafeEqual } from 'node:crypto';

const SECRET = process.env.RESUME_TOKEN_SECRET || 'dev-only-resume-token-secret';

// Read fresh (not cached at module load) so tests can override it via
// RESUME_TOKEN_TTL_MS before a token is signed — same reasoning as
// getSessionTtlMs() in app.ts: a top-level constant would already be
// evaluated before a test ever gets a chance to set the env var.
function getResumeTokenTtlMs(): number {
    return Number(process.env.RESUME_TOKEN_TTL_MS) || 5 * 60 * 1000;
}

// Stateless by design: the token carries everything needed to verify it
// (session id + expiry + signature), so nothing needs to be persisted
// server-side. Verification only requires the secret staying consistent,
// not the session data surviving a restart.
export function signResumeToken(sessionId: string): string {
    const expiresAt = Date.now() + getResumeTokenTtlMs();
    const payload = `${sessionId}.${expiresAt}`;
    const signature = createHmac('sha256', SECRET).update(payload).digest('hex');
    return `${payload}.${signature}`;
}

export function verifyResumeToken(token: string | undefined, expectedSessionId: string): boolean {
    if (!token) {
        return false;
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
        return false;
    }
    const [sessionId, expiresAtRaw, signature] = parts;

    const payload = `${sessionId}.${expiresAtRaw}`;
    const expectedSignature = createHmac('sha256', SECRET).update(payload).digest('hex');

    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);
    // Length check first: timingSafeEqual throws on mismatched buffer
    // lengths rather than returning false, and comparing lengths up front
    // isn't itself a useful timing signal (an attacker already knows the
    // expected signature length — HMAC-SHA256 hex is always 64 characters).
    if (signatureBuffer.length !== expectedBuffer.length) {
        return false;
    }
    if (!timingSafeEqual(signatureBuffer, expectedBuffer)) {
        return false;
    }

    if (sessionId !== expectedSessionId) {
        return false;
    }

    const expiresAt = Number(expiresAtRaw);
    if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) {
        return false;
    }

    return true;
}
