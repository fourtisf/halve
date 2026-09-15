#!/usr/bin/env node
/**
 * Live end-to-end run against a local anvil chain (chain id 4663):
 *   1. start anvil, deploy the mock series (contracts/script/DeployMockSeries.s.sol) and Multicall3
 *   2. build the site with MOCK=false pointed at anvil (separate dist dir, series override)
 *   3. run the Playwright suite in e2e-live/ — a wallet that signs with an anvil account drives the UI
 *
 * Needs forge + anvil in PATH (or FOUNDRY_BIN=dir). Solc download can be pinned with FOUNDRY_SOLC.
 *   pnpm test:e2e:live            full run
 *   pnpm test:e2e:live --no-build reuse .next-live from a previous run
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { deployUniswap } from './lib/uniswap-local.mjs'

const root = resolve(new URL('..', import.meta.url).pathname)
const contracts = resolve(root, 'contracts')
const outDir = resolve(root, '.e2e-live')
const bin = (name) => (process.env.FOUNDRY_BIN ? resolve(process.env.FOUNDRY_BIN, name) : name)

export const RPC = process.env.E2E_RPC ?? 'http://127.0.0.1:8545'
export const PORT = Number(process.env.E2E_LIVE_PORT ?? 3100)
const CHAIN_ID = 4663
const MULTICALL3 = '0xca11bde05977b3631167028862be2a173976ca11'
// anvil's default mnemonic: account 0 deploys and owns the mocks, account 1 is the user in the browser
const DEPLOYER_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
const USER = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'

const skipBuild = process.argv.includes('--no-build')
const playwrightArgs = process.argv.slice(2).filter((a) => a !== '--no-build')

function sh(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', ...opts })
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} exited ${r.status}`)
}

async function rpc(method, params = []) {
  const r = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) })
  const j = await r.json()
  if (j.error) throw new Error(`${method}: ${j.error.message}`)
  return j.result
}

async function waitForAnvil() {
  for (let i = 0; i < 100; i++) {
    try {
      const id = await rpc('eth_chainId')
      if (parseInt(id, 16) === CHAIN_ID) return
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 100))
  }
  throw new Error('anvil did not come up')
}

const anvil = spawn(bin('anvil'), ['--chain-id', String(CHAIN_ID), '--port', new URL(RPC).port, '--silent', '--disable-code-size-limit'], { stdio: 'ignore' })
const stop = () => { if (!anvil.killed) anvil.kill() }
process.on('exit', stop)
process.on('SIGINT', () => { stop(); process.exit(130) })

let code = 1
try {
  await waitForAnvil()
  mkdirSync(outDir, { recursive: true })

  // 1. contracts
  sh(bin('forge'), ['build'], { cwd: contracts })
  const seriesRaw = resolve(contracts, 'series.local.json')
  sh(bin('forge'), ['script', 'script/DeployMockSeries.s.sol', '--rpc-url', RPC, '--broadcast', '--private-key', DEPLOYER_KEY, '-q'], {
    cwd: contracts,
    env: { ...process.env, OUT: 'series.local.json', FUND: USER, TICKER: process.env.TICKER ?? 'JEPI' },
  })
  const series = JSON.parse(readFileSync(seriesRaw, 'utf8'))
  const mc = JSON.parse(readFileSync(resolve(contracts, 'out/Multicall3.sol/Multicall3.json'), 'utf8'))
  await rpc('anvil_setCode', [MULTICALL3, mc.deployedBytecode.object])

  // real Uniswap v3 pools quoted in wStock, exactly as on mainnet (the mock pools stay as a fallback)
  const forgeEnv = { ...process.env, PATH: process.env.PATH }
  sh(bin('forge'), ['script', 'script/DeployWrappedStock.s.sol', '--rpc-url', RPC, '--broadcast', '--private-key', DEPLOYER_KEY, '-q'], {
    cwd: contracts, env: { ...forgeEnv, STOCK: series.underlying, OUT: 'wrapped.local.json' },
  })
  const { wrappedStock } = JSON.parse(readFileSync(resolve(contracts, 'wrapped.local.json'), 'utf8'))
  const uni = await deployUniswap(RPC, DEPLOYER_KEY, series.underlying)
  sh(bin('forge'), ['script', 'script/CreatePools.s.sol:SeedPools', '--rpc-url', RPC, '--broadcast', '--private-key', DEPLOYER_KEY, '-q'], {
    cwd: contracts, env: { ...forgeEnv, VAULT: series.vault, WSTOCK: wrappedStock, NPM: uni.npm, OUT: 'pools.local.json' },
  })
  const pools = JSON.parse(readFileSync(resolve(contracts, 'pools.local.json'), 'utf8'))
  Object.assign(series, { poolPT: pools.poolPT, poolYT: pools.poolYT, quote: 'wrapped', quoteToken: wrappedStock })
  const seriesFile = resolve(outDir, 'series.json')
  writeFileSync(seriesFile, JSON.stringify([series], null, 2))
  console.log(`series ${series.id}: vault ${series.vault}, stock ${series.underlying}, wStock ${wrappedStock}, pools ${pools.poolPT} / ${pools.poolYT} (Uniswap v3 ${uni.factory})`)

  // 2. site
  const env = {
    ...process.env,
    MOCK: 'false',
    NEXT_PUBLIC_MOCK: 'false',
    NEXT_PUBLIC_RPC_URL: RPC,
    SERIES_FILE: seriesFile,
    NEXT_DIST_DIR: '.next-live',
    HISTORY_DIR: resolve(outDir, 'history'),
    E2E_LIVE_PORT: String(PORT),
    E2E_RPC: RPC,
    E2E_SERIES: JSON.stringify(series),
  }
  if (!skipBuild || !existsSync(resolve(root, '.next-live'))) sh('pnpm', ['build'], { cwd: root, env })

  // 3. browser
  const r = spawnSync('pnpm', ['exec', 'playwright', 'test', '-c', 'playwright.live.config.ts', ...playwrightArgs], { cwd: root, env, stdio: 'inherit' })
  code = r.status ?? 1
} catch (e) {
  console.error(e.message)
} finally {
  stop()
}
process.exit(code)
