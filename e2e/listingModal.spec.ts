import { test, expect, type Page } from '@playwright/test';

const LISTING_ID = 'lakers-warriors-112-14';
const TITLE = 'Lakers vs. Warriors';

async function openFromBrowse(page: Page) {
    await page.goto('/');
    await page.locator(`a[href="/listings/${LISTING_ID}"]`).click();
    await expect(page).toHaveURL(`/listings/${LISTING_ID}`);
    await expect(page.getByRole('dialog', { name: TITLE })).toBeVisible();
}

test('clicking a listing on the browse page opens it over the page', async ({ page }) => {
    await openFromBrowse(page);

    const dialog = page.getByRole('dialog', { name: TITLE });
    await expect(dialog.getByRole('button', { name: 'CONTINUE' })).toBeVisible();
    // The browse page is still there underneath, not replaced.
    await expect(page.getByPlaceholder('Search events…')).toBeAttached();
});

for (const [how, close] of [
    ['the close button', (page: Page) => page.getByRole('button', { name: 'Close' }).click()],
    ['Escape', (page: Page) => page.keyboard.press('Escape')],
    ['the browser back button', (page: Page) => page.goBack()],
] as const) {
    test(`${how} closes the modal and leaves the browse page usable`, async ({ page }) => {
        await openFromBrowse(page);

        await close(page);

        await expect(page).toHaveURL('/');
        await expect(page.getByRole('dialog')).toHaveCount(0);
        // An open modal <dialog> makes the rest of the page inert; typing proves it isn't.
        await page.getByPlaceholder('Search events…').fill('dodgers');
        await expect(page.getByPlaceholder('Search events…')).toHaveValue('dodgers');
    });
}

test('a direct visit shows the full listing page, not a modal', async ({ page }) => {
    await page.goto(`/listings/${LISTING_ID}`);

    await expect(page.getByRole('heading', { name: TITLE })).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('refreshing while the modal is open shows the full listing page', async ({ page }) => {
    await openFromBrowse(page);

    await page.reload();

    await expect(page).toHaveURL(`/listings/${LISTING_ID}`);
    await expect(page.getByRole('heading', { name: TITLE })).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
});

// The route with the modal is hidden, not unmounted, when checkout opens. If the
// dialog stayed open while hidden, it would leave the checkout page inert.
test('continuing from the modal reaches a checkout that can be completed', async ({ page }) => {
    await openFromBrowse(page);

    await page.getByRole('dialog', { name: TITLE }).getByRole('button', { name: 'CONTINUE' }).click();
    await page.waitForURL(/\/checkout\//);

    await page.getByRole('button', { name: 'Complete Purchase' }).click();
    await expect(page.getByText('Order complete!')).toBeVisible();
});
