import { defineConfig } from 'playwright/test';
import { baseURL } from './tests/support/settings.mjs';

export default defineConfig({
  testDir: './tests',
  testMatch: /(?:r[1-6]|common)-browser\.mjs$/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  maxFailures: 1,
  forbidOnly: Boolean(process.env.CI),
  timeout: 120000,
  expect: { timeout: 5000 },
  outputDir: process.env.TEST_OUTPUT_DIR ?? 'test-results',
  reporter: [['list'], ['html', { outputFolder: process.env.TEST_REPORT_DIR ?? 'playwright-report', open: 'never' }]],
  use: {
    browserName: 'chromium', baseURL,
    actionTimeout: 15000,
    navigationTimeout: 15000,
    serviceWorkers: 'block',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    // Defense in depth: unexpected external hostnames cannot resolve even if a mock is missed.
    launchOptions: { args: ['--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1, EXCLUDE [::1]'] },
  },
  webServer: {
    command: 'node tests/support/server.mjs',
    url: `${baseURL}/__health`,
    reuseExistingServer: false,
    timeout: 15000,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 5000 },
    stdout: 'pipe', stderr: 'pipe',
  },
});
