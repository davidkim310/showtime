import { createHmac, timingSafeEqual } from 'node:crypto';

// The fallback lets local development and tests run with no setup. It lives in
// this public repository, so in production it would let anyone sign a valid
// deep-link token for any session id they held — hence production refuses it.
// Read fresh on every call, like the TTL below, so tests can set it.
export function getResumeTokenSecret(): string {
    const secret = process.env.RESUME_TOKEN_SECRET;
    if (secret) return secret;
    if (process.env.NODE_ENV === 'production') {
        throw new Error('RESUME_TOKEN_SECRET must be set in production; refusing to sign deep links with a public key.');
    }
    return 'dev-only-resume-token-secret';
}

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
    const signature = createHmac('sha256', getResumeTokenSecret()).update(payload).digest('hex');
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
    const expectedSignature = createHmac('sha256', getResumeTokenSecret()).update(payload).digest('hex');

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
