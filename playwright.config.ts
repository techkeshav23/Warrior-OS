// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Playwright config (E2E smoke)
//
//   npm run build && npm run test:e2e
//
// Runs against the production server (`next start` on port 3100).
// Locally an already-running server on that port is reused.
// Set PW_CHROMIUM_PATH to use a preinstalled Chromium binary instead
// of the one `npx playwright install chromium` downloads.
// Reports and failure artifacts go to tests/.results/ (git-ignored).
// ═══════════════════════════════════════════════════════════

import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;
const CI = Boolean(process.env.CI);
const chromiumPath = process.env.PW_CHROMIUM_PATH?.trim();

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './tests/.results/artifacts',
  // One boot of the OS drives every app; keep it to a single worker.
  fullyParallel: false,
  workers: 1,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  timeout: 180_000,
  expect: { timeout: 10_000 },
  reporter: CI
    ? [['github'], ['html', { outputFolder: './tests/.results/report', open: 'never' }]]
    : [['list']],
  use: {
    baseURL: BASE_URL,
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Large enough for every app window, and above any small-screen gate.
        viewport: { width: 1600, height: 1000 },
        ...(chromiumPath ? { launchOptions: { executablePath: chromiumPath } } : {}),
      },
    },
  ],
  webServer: {
    command: `npm run start -- -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !CI,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
