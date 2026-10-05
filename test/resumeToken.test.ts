// Short TTL so the expiry test doesn't need to wait 5 real minutes — read
// fresh inside signResumeToken (see getResumeTokenTtlMs), so setting this
// before a token is signed is all that's needed.
process.env.RESUME_TOKEN_TTL_MS = '50';

import { getResumeTokenSecret, signResumeToken, verifyResumeToken } from '../src/server/resumeToken';

describe('resumeToken', () => {
    test('a freshly signed token verifies successfully for its own session', () => {
        const token = signResumeToken('session-1');

        expect(verifyResumeToken(token, 'session-1')).toBe(true);
    });

    test('rejects a missing token', () => {
        expect(verifyResumeToken(undefined, 'session-1')).toBe(false);
    });

    test('rejects a token issued for a different session', () => {
        const token = signResumeToken('session-1');

        expect(verifyResumeToken(token, 'session-2')).toBe(false);
    });

    test('rejects a tampered signature', () => {
        const token = signResumeToken('session-1');
        const tamperedLastChar = token.endsWith('a') ? 'b' : 'a';
        const tampered = token.slice(0, -1) + tamperedLastChar;

        expect(verifyResumeToken(tampered, 'session-1')).toBe(false);
    });

    test('rejects an expired token', async () => {
        const token = signResumeToken('session-1');
        await new Promise((resolve) => setTimeout(resolve, 100)); // TTL is 50ms in this file

        expect(verifyResumeToken(token, 'session-1')).toBe(false);
    });

    test('rejects a malformed token', () => {
        expect(verifyResumeToken('not-a-real-token', 'session-1')).toBe(false);
    });
});

describe('the signing secret', () => {
    const env = process.env as Record<string, string | undefined>;
    const original = { NODE_ENV: env.NODE_ENV, RESUME_TOKEN_SECRET: env.RESUME_TOKEN_SECRET };

    // Assigning undefined to process.env stores the string "undefined", so
    // variables that weren't set must be deleted rather than restored.
    afterEach(() => {
        for (const [key, value] of Object.entries(original)) {
            if (value === undefined) delete env[key];
            else env[key] = value;
        }
    });

    // The development fallback is in a public repository: anyone could sign
    // tokens with it, so production must never use it.
    test('production refuses to sign or verify without a configured secret', () => {
        env.NODE_ENV = 'production';
        delete env.RESUME_TOKEN_SECRET;

        expect(() => getResumeTokenSecret()).toThrow('RESUME_TOKEN_SECRET must be set in production');
        expect(() => signResumeToken('session-1')).toThrow();
        expect(() => verifyResumeToken('a.b.c', 'session-1')).toThrow();
    });

    test('production signs with the configured secret', () => {
        Object.assign(env, { NODE_ENV: 'production', RESUME_TOKEN_SECRET: 'a-real-secret' });

        expect(verifyResumeToken(signResumeToken('session-1'), 'session-1')).toBe(true);
    });

    test('a token signed with one secret does not verify under another', () => {
        env.RESUME_TOKEN_SECRET = 'secret-a';
        const token = signResumeToken('session-1');

        env.RESUME_TOKEN_SECRET = 'secret-b';
        expect(verifyResumeToken(token, 'session-1')).toBe(false);
    });
});
