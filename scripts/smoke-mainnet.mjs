#!/usr/bin/env node
/**
 * "Can people really buy?" — a real-money smoke test of one deployed series, run after mainnet.mjs:
 *   approve → split AMOUNT → check PT/YT → (if the pools have liquidity) sell a slice of PT on Uniswap and
 *   buy it back → merge what is left. Every step is a real transaction signed with the .env.mainnet wallet.
 *   node scripts/smoke-mainnet.mjs            # AMOUNT defaults to 1 raw token; TICKER from .env.mainnet
 *   AMOUNT=500000000000000000 node scripts/smoke-mainnet.mjs
 * Exits 1 at the first step that does not behave, and prints what it saw.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { formatUnits } from 'viem'

const root = resolve(new URL('..', import.meta.url).pathname)
const env = { ...process.env }
const envFile = resolve(root, process.env.MAINNET_ENV ?? '.env.mainnet')
if (existsSync(envFile)) for (const line of readFileSync(envFile, 'utf8').split('\n')) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line)
  if (m && !(m[1] in process.env)) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const RPC = env.RPC_URL ?? 'https://rpc.mainnet.chain.robinhood.com'
const ROUTER = env.ROUTER ?? '0xcaf681a66d020601342297493863e78c959e5cb2' // SwapRouter02 on Robinhood Chain
const AMOUNT = BigInt(env.AMOUNT ?? '1000000000000000000')
const walletArgs = env.DEPLOYER_KEY ? ['--private-key', env.DEPLOYER_KEY] : env.WALLET_ARGS ? env.WALLET_ARGS.split(/\s+/) : null
if (!walletArgs) { console.error('set DEPLOYER_KEY or WALLET_ARGS in .env.mainnet'); process.exit(2) }
const bin = (n) => (env.FOUNDRY_BIN ? resolve(env.FOUNDRY_BIN, n) : n)
const seriesId = env.SERIES_ID
const ticker = env.TICKER
const series = JSON.parse(readFileSync(resolve(root, 'src/contracts/series.json'), 'utf8')).find((s) => (seriesId ? s.id === seriesId : s.ticker === ticker))
if (!series || /^0x0+$/.test(series.vault)) { console.error(`series ${seriesId ?? ticker} is not deployed in series.json`); process.exit(2) }

const cast = (args) => {
  const r = spawnSync(bin('cast'), args, { encoding: 'utf8' })
  if (r.status !== 0) throw new Error(`cast ${args.slice(0, 3).join(' ')}: ${(r.stderr || r.stdout).trim().split('\n').slice(-3).join(' | ')}`)
  return r.stdout.trim()
}
const call = (to, sig, ...args) => cast(['call', to, sig, ...args, '--rpc-url', RPC])
const send = (to, sig, ...args) => cast(['send', to, sig, ...args, '--rpc-url', RPC, ...walletArgs, '--json'])
const me = cast(['wallet', 'address', ...walletArgs])
const bal = (token, who) => BigInt(call(token, 'balanceOf(address)(uint256)', who).split(' ')[0])
const fmt = (v) => formatUnits(v, series.decimals ?? 18)
let step = 0
const log = (m) => console.log(`${++step}. ${m}`)
const txOk = (json, what) => { const j = JSON.parse(json); if (j.status !== '0x1') throw new Error(`${what} reverted (${j.transactionHash})`); return j.transactionHash }

try {
  log(`wallet ${me} on ${RPC}; series ${series.id}; vault ${series.vault}`)
  const stock0 = bal(series.underlying, me)
  if (stock0 < AMOUNT) throw new Error(`wallet holds ${fmt(stock0)} ${series.ticker}, needs ${fmt(AMOUNT)}`)
  log(`stock balance ${fmt(stock0)} · uiMultiplier ${formatUnits(BigInt(call(series.underlying, 'uiMultiplier()(uint256)').split(' ')[0]), 18)}`)

  // split
  txOk(send(series.underlying, 'approve(address,uint256)', series.vault, AMOUNT.toString()), 'approve')
  const h1 = txOk(send(series.vault, 'split(uint256)', AMOUNT.toString()), 'split')
  const pt0 = bal(series.pt, me), yt0 = bal(series.yt, me)
  const expected = AMOUNT - (AMOUNT * 10n) / 10000n
  if (pt0 < expected || yt0 < expected) throw new Error(`split minted PT ${fmt(pt0)} / YT ${fmt(yt0)}, expected ≥ ${fmt(expected)}`)
  log(`split ${fmt(AMOUNT)} → +${fmt(expected)} PT / YT (tx ${h1}); vault totalDeposits ${fmt(BigInt(call(series.vault, 'totalDeposits()(uint256)').split(' ')[0]))}`)

  // trade, if the PT pool has liquidity
  const liq = BigInt(call(series.poolPT, 'liquidity()(uint128)').split(' ')[0])
  if (liq > 0n) {
    const slice = expected / 10n
    txOk(send(series.pt, 'approve(address,uint256)', ROUTER, slice.toString()), 'approve PT')
    const fee = call(series.poolPT, 'fee()(uint24)').split(' ')[0]
    const stockBefore = bal(series.underlying, me)
    const h2 = txOk(send(ROUTER, 'exactInputSingle((address,address,uint24,address,uint256,uint256,uint160))', `(${series.pt},${series.underlying},${fee},${me},${slice},0,0)`), 'swap PT → stock')
    const got = bal(series.underlying, me) - stockBefore
    if (got <= 0n) throw new Error('swap paid nothing')
    log(`sold ${fmt(slice)} PT on Uniswap for ${fmt(got)} ${series.ticker} (tx ${h2}) — price ${(Number(got) / Number(slice)).toFixed(4)} stock per PT`)
    txOk(send(series.underlying, 'approve(address,uint256)', ROUTER, got.toString()), 'approve stock')
    const ptBefore = bal(series.pt, me)
    const h3 = txOk(send(ROUTER, 'exactInputSingle((address,address,uint24,address,uint256,uint256,uint160))', `(${series.underlying},${series.pt},${fee},${me},${got},0,0)`), 'swap stock → PT')
    log(`bought ${fmt(bal(series.pt, me) - ptBefore)} PT back (tx ${h3})`)
  } else log(`PT pool ${series.poolPT} has no liquidity yet: trading not tested (seed it, or wait for LPs)`)

  // merge what is left
  const pt1 = bal(series.pt, me), yt1 = bal(series.yt, me)
  const mergeAmt = pt1 < yt1 ? pt1 : yt1
  const stockBeforeMerge = bal(series.underlying, me)
  const h4 = txOk(send(series.vault, 'merge(uint256)', mergeAmt.toString()), 'merge')
  const back = bal(series.underlying, me) - stockBeforeMerge
  if (back !== mergeAmt) throw new Error(`merge of ${fmt(mergeAmt)} paid ${fmt(back)}`)
  log(`merged ${fmt(mergeAmt)} PT + YT → ${fmt(back)} ${series.ticker} (tx ${h4}); leftover PT ${fmt(pt1 - mergeAmt)} / YT ${fmt(yt1 - mergeAmt)}`)
  console.log(`\nsmoke test passed: split, ${liq > 0n ? 'trade on Uniswap, ' : ''}merge all behave on ${series.id}`)
} catch (e) {
  console.error(`\n✗ ${e.message}`)
  process.exit(1)
}
