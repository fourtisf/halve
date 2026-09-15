#!/usr/bin/env node
/**
 * Keeper: calls accountant.sync() for every live series whose stock token multiplier moved.
 * Late is fine (the vault pauses splits meanwhile), wrong is impossible (sync is rule-based). Run from cron:
 *   (every 10 minutes)  cd ~/halve/halve && node scripts/keeper.mjs >> /var/log/halve/keeper.log 2>&1
 * Signing comes from .env.mainnet (WALLET_ARGS or DEPLOYER_KEY); any funded wallet can be the keeper.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(new URL('..', import.meta.url).pathname)
const env = { ...process.env }
const envFile = resolve(root, process.env.MAINNET_ENV ?? '.env.mainnet')
if (existsSync(envFile)) for (const line of readFileSync(envFile, 'utf8').split('\n')) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line)
  if (m && !(m[1] in process.env)) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const RPC = env.RPC_URL ?? 'https://rpc.mainnet.chain.robinhood.com'
const walletArgs = env.DEPLOYER_KEY ? ['--private-key', env.DEPLOYER_KEY] : env.WALLET_ARGS ? env.WALLET_ARGS.split(/\s+/) : null
const bin = (n) => (env.FOUNDRY_BIN ? resolve(env.FOUNDRY_BIN, n) : n)
const seriesFile = env.SERIES_FILE ?? resolve(root, 'src/contracts/series.json')
const cast = (args) => { const r = spawnSync(bin('cast'), args, { encoding: 'utf8' }); if (r.status !== 0) throw new Error((r.stderr || r.stdout).trim().split('\n').slice(-2).join(' | ')); return r.stdout.trim() }
const call = (to, sig) => cast(['call', to, sig, '--rpc-url', RPC]).split(' ')[0]

const live = JSON.parse(readFileSync(seriesFile, 'utf8')).filter((s) => !/^0x0+$/.test(s.accountant))
const stamp = new Date().toISOString()
let failures = 0
const seen = new Set()
for (const s of live) {
  if (seen.has(s.accountant.toLowerCase())) continue // one accountant per stock token, shared across its series
  seen.add(s.accountant.toLowerCase())
  try {
    const current = BigInt(call(s.underlying, 'uiMultiplier()(uint256)'))
    const last = BigInt(call(s.accountant, 'lastMultiplier()(uint256)'))
    const synced = call(s.accountant, 'isSynced()(bool)') === 'true'
    if (!synced) { console.log(`${stamp} ${s.ticker}: held (pending guardian); multiplier ${current}`); continue }
    if (current === last) { console.log(`${stamp} ${s.ticker}: in sync (${current})`); continue }
    if (!walletArgs) { console.log(`${stamp} ${s.ticker}: multiplier moved ${last} → ${current} but no signer configured`); failures++; continue }
    const r = JSON.parse(cast(['send', s.accountant, 'sync()', '--rpc-url', RPC, ...walletArgs, '--json']))
    const count = call(s.accountant, 'checkpointCount()(uint256)')
    console.log(`${stamp} ${s.ticker}: synced ${last} → ${current} (tx ${r.transactionHash}, ${r.status === '0x1' ? 'ok' : 'REVERTED'}); checkpoints ${count}; synced=${call(s.accountant, 'isSynced()(bool)')}`)
    if (r.status !== '0x1') failures++
  } catch (e) { failures++; console.log(`${stamp} ${s.ticker}: error ${e.message}`) }
}
process.exit(failures ? 1 : 0)
