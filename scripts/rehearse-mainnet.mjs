#!/usr/bin/env node
/**
 * Rehearses scripts/mainnet.mjs on a local anvil (chain id 4663): mock stock token + price feed, the real
 * Uniswap v3 factory and position manager, then the exact deployer flow with a generated .env file.
 * Restores src/contracts/series.json afterwards unless --keep is passed.
 *   node scripts/rehearse-mainnet.mjs
 */
import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { deployUniswap } from './lib/uniswap-local.mjs'

const root = resolve(new URL('..', import.meta.url).pathname)
const contracts = resolve(root, 'contracts')
const bin = (name) => (process.env.FOUNDRY_BIN ? resolve(process.env.FOUNDRY_BIN, name) : name)
const RPC = 'http://127.0.0.1:8546'
const KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
const keep = process.argv.includes('--keep')
const useKeystore = process.argv.includes('--keystore') // sign through a forge keystore (WALLET_ARGS) instead of DEPLOYER_KEY

const rpc = async (method, params = []) => {
  const r = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) })
  const j = await r.json(); if (j.error) throw new Error(j.error.message); return j.result
}
const sh = (cmd, args, opts = {}) => { const r = spawnSync(cmd, args, { stdio: 'inherit', ...opts }); if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} exited ${r.status}`) }

const anvil = spawn(bin('anvil'), ['--chain-id', '4663', '--port', '8546', '--silent', '--disable-code-size-limit'], { stdio: 'ignore' })
const seriesPath = resolve(root, 'src/contracts/series.json')
const original = readFileSync(seriesPath, 'utf8')
let code = 1
try {
  for (let i = 0; i < 100; i++) { try { if (parseInt(await rpc('eth_chainId'), 16) === 4663) break } catch { /* not up */ } await new Promise((r) => setTimeout(r, 100)) }
  sh(bin('forge'), ['build'], { cwd: contracts })
  // a mock stock token, feed and Multicall3, as the chain would have them
  sh(bin('forge'), ['script', 'script/DeployMockSeries.s.sol', '--rpc-url', RPC, '--broadcast', '--private-key', KEY, '-q'], { cwd: contracts, env: { ...process.env, OUT: 'series.local.json', TICKER: 'JEPI' } })
  const mock = JSON.parse(readFileSync(resolve(contracts, 'series.local.json'), 'utf8'))
  const mc = JSON.parse(readFileSync(resolve(contracts, 'out/Multicall3.sol/Multicall3.json'), 'utf8'))
  await rpc('anvil_setCode', ['0xca11bde05977b3631167028862be2a173976ca11', mc.deployedBytecode.object])
  const uni = await deployUniswap(RPC, KEY, mock.underlying)

  const dir = resolve(root, '.e2e-live'); mkdirSync(dir, { recursive: true })
  let signing = `DEPLOYER_KEY=${KEY}`
  if (useKeystore) {
    const ks = resolve(dir, 'keystore'); mkdirSync(ks, { recursive: true })
    spawnSync('rm', ['-f', resolve(ks, 'rehearsal')])
    sh(bin('cast'), ['wallet', 'import', 'rehearsal', '--private-key', KEY, '--unsafe-password', 'rehearsal', '--keystore-dir', ks])
    signing = `WALLET_ARGS=--keystore ${resolve(ks, 'rehearsal')} --password rehearsal`
  }
  const envFile = resolve(dir, 'env.rehearsal')
  writeFileSync(envFile, [
    signing, `RPC_URL=${RPC}`, 'CHAIN_ID=4663', 'VERIFY=0',
    `STOCK=${mock.underlying}`, 'TICKER=JEPI', 'SERIES_ID=JEPI-MAR27', `MATURITY=${Math.floor(Date.now() / 1000) + 180 * 86400}`,
    'CAP=1000000000000000000000000', `TREASURY=0x70997970C51812dc3A010C7d01b50e0d17dc79C8`, `GUARDIAN=0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC`, `OWNER=0x90F79bf6EB2c4f870365E785982E1f101E93b906`,
    `PRICE_FEED=${mock.priceFeed}`, `NPM=${uni.npm}`, 'QUOTE_KIND=wrapped', 'FEE=3000', 'SEED_AMOUNT=10000000000000000000000',
  ].join('\n'))
  console.log('\n=== dry run ===')
  sh(process.execPath, [resolve(root, 'scripts/mainnet.mjs'), '--dry-run'], { env: { ...process.env, MAINNET_ENV: envFile } })
  console.log('\n=== real run against anvil ===')
  sh(process.execPath, [resolve(root, 'scripts/mainnet.mjs')], { env: { ...process.env, MAINNET_ENV: envFile } })
  const after = JSON.parse(readFileSync(seriesPath, 'utf8')).find((s) => s.id === 'JEPI-MAR27')
  for (const k of ['vault', 'pt', 'yt', 'accountant', 'poolPT', 'poolYT', 'quoteToken']) if (!after[k] || /^0x0+$/.test(after[k])) throw new Error(`series.json ${k} not filled`)
  if (after.quote !== 'wrapped') throw new Error('series.json quote not wrapped')
  console.log(`\nrehearsal ok: JEPI-MAR27 → vault ${after.vault}, pools ${after.poolPT} / ${after.poolYT}`)
  code = 0
} catch (e) {
  console.error(e.message)
} finally {
  if (!keep) writeFileSync(seriesPath, original)
  if (!anvil.killed) anvil.kill()
}
process.exit(code)
