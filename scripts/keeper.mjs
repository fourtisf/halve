#!/usr/bin/env node
/**
 * Keeper: calls accountant.sync() for every live series whose stock token multiplier moved. Wrong is impossible
 * (sync is rule-based); late costs precision, not safety: a dividend the keeper has not synced when a series
 * matures is still pulled in by settle() itself, and a held change only pauses splits. Run from cron every
 * 10 minutes with an explicit PATH (cron's own PATH has neither node nor cast) and a lock; the exact crontab
 * lines are in docs/MAINNET.md under "Keeper".
 * Signing comes from .env.mainnet or MAINNET_ENV (WALLET_ARGS); any funded wallet can be the keeper, and a
 * separate low-value one is the right choice for a cron job on the serving host.
 */
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadEnv, refusePlaintextKey, walletArgsFrom } from './lib/env.mjs'

const root = resolve(new URL('..', import.meta.url).pathname)
const env = loadEnv(resolve(root, process.env.MAINNET_ENV ?? '.env.mainnet'))
const RPC = env.RPC_URL ?? 'https://rpc.mainnet.chain.robinhood.com'
const walletArgs = walletArgsFrom(env)
refusePlaintextKey(env, RPC)
const bin = (n) => (env.FOUNDRY_BIN ? resolve(env.FOUNDRY_BIN, n) : n)
const seriesFile = env.SERIES_FILE ?? resolve(root, 'src/contracts/series.json')
const cast = (args) => {
  const r = spawnSync(bin('cast'), args, { encoding: 'utf8', timeout: 60_000 })
  if (r.error) throw new Error(r.error.code === 'ENOENT' ? `cast not found (PATH=${process.env.PATH}); set FOUNDRY_BIN or PATH in the crontab` : r.error.message)
  if (r.status !== 0) throw new Error((r.stderr || r.stdout).trim().split('\n').slice(-2).join(' | '))
  return r.stdout.trim()
}
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
    if (!synced) { console.log(`${stamp} ${s.ticker}: HELD — a change is waiting for the guardian (resolvePending after the 2-day timelock); multiplier ${current}`); failures++; continue }
    if (current === last) { console.log(`${stamp} ${s.ticker}: in sync (${current})`); continue }
    if (!walletArgs) { console.log(`${stamp} ${s.ticker}: multiplier moved ${last} → ${current} but no signer configured`); failures++; continue }
    const r = JSON.parse(cast(['send', s.accountant, 'sync()', '--rpc-url', RPC, ...walletArgs, '--json']))
    const count = call(s.accountant, 'checkpointCount()(uint256)')
    console.log(`${stamp} ${s.ticker}: synced ${last} → ${current} (tx ${r.transactionHash}, ${r.status === '0x1' ? 'ok' : 'REVERTED'}); checkpoints ${count}; synced=${call(s.accountant, 'isSynced()(bool)')}`)
    if (r.status !== '0x1') failures++
  } catch (e) { failures++; console.log(`${stamp} ${s.ticker}: error ${e.message}`) }
}
process.exit(failures ? 1 : 0)
