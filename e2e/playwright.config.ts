import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests against a running app (all services and the web app), as a person uses it.
 * In CI the app runs in mock mode, so answers are canned; the tests check behaviour, not wording,
 * so they also pass against a live local stack. Locally they use the installed Chrome.
 */
const ci = Boolean(process.env.CI);

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  retries: ci ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 20_000 },
  reporter: ci ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    ...(ci ? {} : { channel: 'chrome' }),
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], ...(ci ? {} : { channel: 'chrome' }) },
      grepInvert: /@phone/,
    },
    {
      name: 'phone',
      use: { ...devices['Pixel 7'], ...(ci ? {} : { channel: 'chrome' }) },
      grep: /@phone/,
    },
  ],
});
