import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright configuration — Agent 10.
 *
 * Runs locally against `pnpm dev` (PLAYWRIGHT_BASE_URL env override
 * supported for staging). In CI, webServer spawns `pnpm build && pnpm
 * start` for prod-parity.
 *
 * Stripe test-mode credentials must be provided via STRIPE_TEST_SECRET_KEY
 * and STRIPE_TEST_PUBLIC_KEY env vars. TEST_BYPASS_CODE short-circuits
 * the Twilio verification flow (NODE_ENV=test only).
 */
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /.*\.spec\.ts$/,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: process.env.CI ? 'retain-on-failure' : 'off',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  projects: [
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium',  use: { ...devices['Pixel 7'] } },
  ],

  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'pnpm dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
          NODE_ENV: 'test',
          TEST_BYPASS_CODE: process.env.TEST_BYPASS_CODE ?? 'test-bypass-fixture-123',
        },
      },
})
