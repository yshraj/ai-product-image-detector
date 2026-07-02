// playwright.config.cjs — Chrome extension E2E test runner
const { defineConfig, devices } = require('@playwright/test');

const isCI = !!process.env.CI;

module.exports = defineConfig({
  testDir: './test/e2e',
  testMatch: '**/*.spec.cjs',
  testIgnore: process.env.RUN_LIVE_COMPARE
    ? []
    : [
      '**/compare-real-products.spec.cjs',
      '**/compare-regression.spec.cjs',
      '**/compare.spec.cjs',
      '**/compare-hardening.spec.cjs',
      '**/shopping-assistant.spec.cjs',
    ],
  timeout: 60_000,
  expect: { timeout: 15_000 },

  // Extension tests share a worker-scoped browser; parallelise across workers only.
  fullyParallel: true,
  workers: isCI ? 2 : 1,
  retries: isCI ? 2 : 0,
  forbidOnly: isCI,

  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ...(isCI ? [['github']] : []),
  ],

  use: {
    ...devices['Desktop Chrome'],
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
  },

  outputDir: 'test-results',

  projects: [
    {
      name: 'extension-chromium',
      testMatch: '**/*.spec.cjs',
    },
  ],
});
