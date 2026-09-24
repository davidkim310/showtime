import { test, expect, type Page } from '@playwright/test';

// These specs drive the real browser: they are the only coverage of hydration
// and of what happens after a click — the Jest page tests render markup only.

const LISTING_ID = 'lakers-warriors-112-14';

test.afterEach(async ({ request }) => {
    await request.post(`/api/debug/listings/${LISTING_ID}/reset`);
    await request.post('/api/debug/payment/force-result', { data: { succeeds: true } });
});

async function startCheckout(page: Page, qty = '2') {
    await page.goto(`/listings/${LISTING_ID}`);
    await page.getByLabel('Quantity').selectOption(qty);
    await page.getByRole('button', { name: 'CONTINUE' }).click();
    await page.waitForURL(/\/checkout\//);
}

test('a buyer completes a purchase and sees the order', async ({ page }) => {
    await startCheckout(page);

    await expect(page.getByText('Ready to complete your purchase.')).toBeVisible();
    await expect(page.getByText('Time left to complete purchase:')).toBeVisible();
    await expect(page.getByText('$290.00')).toBeVisible();

    await page.getByRole('button', { name: 'Complete Purchase' }).click();

    await expect(page.getByText('Order complete!')).toBeVisible();
    await expect(page.getByText(/Order ID: .+/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'View Order' })).toBeDisabled();
});

test('a price change mid-checkout must be accepted before completing', async ({ page, request }) => {
    await startCheckout(page);

    await request.post(`/api/debug/listings/${LISTING_ID}/price`, { data: { price: 199 } });
    await page.reload();

    await expect(page.getByText('Price changed since you started checkout.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Complete Purchase' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Accept New Price' }).click();

    await expect(page.getByText('Ready to complete your purchase.')).toBeVisible();
    await expect(page.getByText('$398.00')).toBeVisible();

    await page.getByRole('button', { name: 'Complete Purchase' }).click();
    await expect(page.getByText('Order complete!')).toBeVisible();
});

test('a failed payment can be retried', async ({ page, request }) => {
    await startCheckout(page);
    await request.post('/api/debug/payment/force-result', { data: { succeeds: false } });

    await page.getByRole('button', { name: 'Complete Purchase' }).click();
    await expect(page.getByText("Your payment didn't go through")).toBeVisible();

    await request.post('/api/debug/payment/force-result', { data: { succeeds: true } });
    await page.getByRole('button', { name: 'Retry Purchase' }).click();

    await expect(page.getByText('Order complete!')).toBeVisible();
});

test('saving a new card returns to checkout with it selected', async ({ page }) => {
    await startCheckout(page);

    await page.getByRole('combobox').selectOption('__add_new_card__');
    await page.waitForURL(/\/payment-methods\/new$/);

    await page.getByRole('textbox', { name: /Card Number/ }).fill('4242424242424242');
    await page.getByRole('textbox', { name: 'Cardholder Name' }).fill('David Kim');
    await page.getByRole('textbox', { name: 'Expiration (MM/YY)' }).fill('1230');
    await page.getByRole('textbox', { name: 'CVC' }).fill('123');
    await page.getByRole('button', { name: 'Save Card' }).click();

    await page.waitForURL(/\/checkout\/.*paymentMethodId=/);
    await expect(page.getByRole('combobox')).toContainText('Visa •••• 4242');
});
