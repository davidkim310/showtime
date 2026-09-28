import { test, expect } from '@playwright/test';

// Headers come from layouts now, not from each page, so this pins which
// surface gets which: exactly one header per page, and none on mobile.

const LISTING_ID = 'lakers-warriors-112-14';

test('each surface gets its own header, exactly once', async ({ page, request }) => {
    const res = await request.post('/api/checkout-sessions', { data: { listingId: LISTING_ID, qty: 2 } });
    const { session, resumeToken } = await res.json();

    const expected = [
        { path: '/', header: 'Checkout Continuity' },
        { path: `/listings/${LISTING_ID}`, header: 'Checkout Continuity' },
        { path: `/checkout/${session.id}`, header: '🛡 Checkout' },
        { path: `/checkout/${session.id}/payment-methods/new`, header: '🛡 Checkout' },
    ];

    for (const { path, header } of expected) {
        await page.goto(path);
        await expect(page.locator('header'), path).toHaveCount(1);
        await expect(page.locator('header'), path).toHaveText(header);
    }

    await page.goto(`/mobile/checkout/${session.id}?token=${resumeToken}`);
    await expect(page.getByText('Opened from mobile deep link')).toBeVisible();
    await expect(page.locator('header')).toHaveCount(0);
});
