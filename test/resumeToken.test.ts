// Short TTL so the expiry test doesn't need to wait 5 real minutes — read
// fresh inside signResumeToken (see getResumeTokenTtlMs), so setting this
// before a token is signed is all that's needed.
process.env.RESUME_TOKEN_TTL_MS = '50';

import { signResumeToken, verifyResumeToken } from '../src/server/resumeToken';

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
