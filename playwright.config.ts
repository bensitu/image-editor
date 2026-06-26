import { defineConfig, devices } from '@playwright/test';

const browserTestPort = 4175;
const browserTestBaseUrl = `http://127.0.0.1:${browserTestPort}`;

export default defineConfig({
    testDir: './tests/browser',
    fullyParallel: false,
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
    outputDir: 'test-results/browser',
    snapshotPathTemplate: '{testDir}/__snapshots__/{testFilePath}/{arg}{ext}',
    use: {
        baseURL: browserTestBaseUrl,
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
        viewport: { width: 1280, height: 900 },
        deviceScaleFactor: 1,
    },
    webServer: {
        command: `npx vite --config tests/browser/vite.config.ts --host 127.0.0.1 --port ${browserTestPort}`,
        url: `${browserTestBaseUrl}/tests/browser/pages/basic-editor.html`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
});
