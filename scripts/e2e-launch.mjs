#!/usr/bin/env node
/**
 * Launch-day rehearsal of the site itself: a MOCK=false build with src/contracts/series.json exactly as
 * committed and the market feed off. That is what halve.finance serves between "MOCK=false" and the first
 * deployed series, and what every not-yet-deployed series looks like after it. The suite in e2e-launch/ proves
 * the build invents nothing: no demo balances, ledger, chart or TVL, no Earn tab, no lending numbers, no demo
 * wallet, and an action button that says the series is not open.
 *
 * The RPC is pointed at a closed local port so the run is hermetic: with nothing deployed the app has no
 * contract to read anyway, and /api/health stays green without a chain (`live: 0`).
 *   pnpm test:e2e:launch [--no-build]   (--no-build reuses .next-launch from a previous run)
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(new URL('..', import.meta.url).pathname)
const skipBuild = process.argv.includes('--no-build')
const playwrightArgs = process.argv.slice(2).filter((a) => a !== '--no-build')
const env = {
  ...process.env,
  MOCK: 'false',
  NEXT_PUBLIC_MOCK: 'false',
  LIVE_MARKET: 'false',
  NEXT_DIST_DIR: '.next-launch',
  NEXT_PUBLIC_RPC_URL: 'http://127.0.0.1:9',
}

const sh = (cmd, args) => {
  const r = spawnSync(cmd, args, { stdio: 'inherit', cwd: root, env })
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} exited ${r.status}`)
}

try {
  if (!skipBuild || !existsSync(resolve(root, '.next-launch'))) sh('pnpm', ['build'])
  sh('pnpm', ['exec', 'playwright', 'test', '-c', 'playwright.launch.config.ts', ...playwrightArgs])
} catch (e) {
  console.error(e.message)
  process.exit(1)
}
