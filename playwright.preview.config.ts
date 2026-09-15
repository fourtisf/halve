import { defineConfig, devices } from '@playwright/test'

/** The demo build with LIVE_MARKET=fixture: real-price preview UI on deterministic quotes, no network. */
const PORT = Number(process.env.E2E_PREVIEW_PORT ?? 3124)

export default defineConfig({
  testDir: 'e2e-preview',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  projects: [{ name: 'preview', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `pnpm start -p ${PORT}`,
    env: { ...(process.env as Record<string, string>), LIVE_MARKET: 'fixture' },
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
