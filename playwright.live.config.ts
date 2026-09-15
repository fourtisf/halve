import { defineConfig, devices } from '@playwright/test'

// Driven by scripts/e2e-live.mjs: MOCK=false build in .next-live against a local anvil on chain 4663.
const PORT = Number(process.env.E2E_LIVE_PORT ?? 3100)

export default defineConfig({
  testDir: 'e2e-live',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  timeout: 90_000,
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  projects: [{ name: 'live', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `pnpm start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
})
