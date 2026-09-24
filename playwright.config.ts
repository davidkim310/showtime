import { defineConfig, devices } from '@playwright/test';

const baseURL = 'http://localhost:3000';

export default defineConfig({
    testDir: './e2e',
    // Inventory and sessions are global in-memory state, and specs change
    // prices through the debug routes, so they can't run against each other.
    workers: 1,
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    reporter: process.env.CI ? 'line' : 'list',
    use: { baseURL, trace: 'on-first-retry' },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
    webServer: {
        command: 'npm run dev',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
    },
});
