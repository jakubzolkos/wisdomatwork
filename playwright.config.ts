import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests (tests/e2e). Run: bun run test:e2e
 *
 * Starts the app on port 3100 (3000 is often taken by another project)
 * unless one is already running there, or points at E2E_BASE_URL
 * (e.g. a preview deployment) when that's set.
 *
 * These tests only make signed-out requests, so they're safe to run
 * against the real database: nothing is written.
 */
const PORT = 3100
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `bunx next dev --port ${PORT}`,
        url: `http://localhost:${PORT}/auth/login`,
        reuseExistingServer: true,
        timeout: 180_000,
      },
})
