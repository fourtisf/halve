import { defineConfig, devices } from '@playwright/test'

// Driven by scripts/e2e-launch.mjs: a MOCK=false build in .next-launch with series.json exactly as committed
// and the market feed off, i.e. what a live host serves for every series that is not deployed yet.
const PORT = Number(process.env.E2E_LAUNCH_PORT ?? 3200)

export default defineConfig({
  testDir: 'e2e-launch',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  projects: [{ name: 'launch', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `pnpm start -p ${PORT}`,
    env: { ...(process.env as Record<string, string>), NEXT_DIST_DIR: '.next-launch', LIVE_MARKET: 'false' },
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
})
