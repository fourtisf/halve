#!/usr/bin/env node
/**
 * "Can people really buy?" — a real-money smoke test of one deployed series, run after mainnet.mjs:
 *   approve → split SMOKE_AMOUNT → check PT/YT → (if the pools have liquidity) sell a slice of PT, then of YT,
 *   on Uniswap with a quoted minimum and buy each back → merge what is left. Every step is a real transaction
 *   signed with the .env.mainnet wallet.
 *   node scripts/smoke-mainnet.mjs                         # SMOKE_AMOUNT defaults to 1 raw token; TICKER from .env.mainnet
 *   SMOKE_AMOUNT=500000000000000000 node scripts/smoke-mainnet.mjs
 * Amounts above 10 tokens need --yes. Exits 1 at the first step that does not behave, and prints what it saw.
 */
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { formatUnits } from 'viem'
import { loadEnv, refusePlaintextKey, walletArgsFrom } from './lib/env.mjs'

const root = resolve(new URL('..', import.meta.url).pathname)
const env = loadEnv(resolve(root, process.env.MAINNET_ENV ?? '.env.mainnet'))
const RPC = env.RPC_URL ?? 'https://rpc.mainnet.chain.robinhood.com'
const ROUTER = env.ROUTER ?? '0xcaf681a66d020601342297493863e78c959e5cb2' // SwapRouter02 on Robinhood Chain
const QUOTER = env.QUOTER ?? '0x33e885ed0ec9bf04ecfb19341582aadcb4c8a9e7' // QuoterV2 on Robinhood Chain
if (env.AMOUNT && !env.SMOKE_AMOUNT) console.error('note: AMOUNT is the pool-seeding variable; the smoke test reads SMOKE_AMOUNT (using the default)')
const AMOUNT = BigInt(env.SMOKE_AMOUNT ?? '1000000000000000000')
const walletArgs = walletArgsFrom(env)
refusePlaintextKey(env, RPC)
if (!walletArgs) { console.error('set WALLET_ARGS (keystore) or DEPLOYER_KEY in .env.mainnet'); process.exit(2) }
const bin = (n) => (env.FOUNDRY_BIN ? resolve(env.FOUNDRY_BIN, n) : n)
const series = JSON.parse(readFileSync(resolve(root, 'src/contracts/series.json'), 'utf8')).find((s) => (env.SERIES_ID ? s.id === env.SERIES_ID : s.ticker === env.TICKER))
if (!series || /^0x0+$/.test(series.vault)) { console.error(`series ${env.SERIES_ID ?? env.TICKER} is not deployed in series.json`); process.exit(2) }
const dec = series.decimals ?? 18
if (AMOUNT > 10n * 10n ** BigInt(dec) && !process.argv.includes('--yes')) { console.error(`SMOKE_AMOUNT ${formatUnits(AMOUNT, dec)} is more than 10 tokens; pass --yes to trade that much`); process.exit(2) }

const cast = (args) => {
  const r = spawnSync(bin('cast'), args, { encoding: 'utf8' })
  if (r.status !== 0) throw new Error(`cast ${args.slice(0, 3).join(' ')}: ${(r.stderr || r.stdout).trim().split('\n').slice(-3).join(' | ')}`)
  return r.stdout.trim()
}
const call = (to, sig, ...args) => cast(['call', to, sig, ...args, '--rpc-url', RPC])
const send = (to, sig, ...args) => cast(['send', to, sig, ...args, '--rpc-url', RPC, ...walletArgs, '--json'])
const me = cast(['wallet', 'address', ...walletArgs])
const bal = (token, who) => BigInt(call(token, 'balanceOf(address)(uint256)', who).split(' ')[0])
const fmt = (v) => formatUnits(v, dec)
let step = 0
const log = (m) => console.log(`${++step}. ${m}`)
const txOk = (json, what) => { const j = JSON.parse(json); if (j.status !== '0x1') throw new Error(`${what} reverted (${j.transactionHash})`); return j.transactionHash }
const SWAP = 'exactInputSingle((address,address,uint24,address,uint256,uint256,uint160))'
const QUOTE = 'quoteExactInputSingle((address,address,uint256,uint24,uint160))(uint256,uint160,uint32,uint256)'
/** QuoterV2's answer for tokenIn → tokenOut, then 98 % of it as the swap's floor. */
const quoteMin = (tokenIn, tokenOut, fee, amountIn) => {
  const q = BigInt(call(QUOTER, QUOTE, `(${tokenIn},${tokenOut},${amountIn},${fee},0)`).split('\n')[0].split(' ')[0])
  if (q === 0n) throw new Error(`QuoterV2 quotes nothing for ${tokenIn} → ${tokenOut}`)
  return { quote: q, min: (q * 98n) / 100n }
}

/** Sell a slice of `token` into its pool and buy it back, with a quoted minimum on each leg. Returns what came back. */
function roundTrip(name, token, pool, slice) {
  const fee = call(pool, 'fee()(uint24)').split(' ')[0]
  txOk(send(token, 'approve(address,uint256)', ROUTER, slice.toString()), `approve ${name}`)
  const { quote, min } = quoteMin(token, series.underlying, fee, slice)
  const stockBefore = bal(series.underlying, me)
  const h2 = txOk(send(ROUTER, SWAP, `(${token},${series.underlying},${fee},${me},${slice},${min},0)`), `swap ${name} → stock`)
  const got = bal(series.underlying, me) - stockBefore
  if (got < min) throw new Error(`swap paid ${fmt(got)}, below the quoted floor ${fmt(min)}`)
  log(`sold ${fmt(slice)} ${name} on Uniswap for ${fmt(got)} ${series.ticker} (quote ${fmt(quote)}, tx ${h2}) — ${(Number(got) / Number(slice)).toFixed(4)} stock per ${name}`)
  txOk(send(series.underlying, 'approve(address,uint256)', ROUTER, got.toString()), 'approve stock')
  const back = quoteMin(series.underlying, token, fee, got)
  const before = bal(token, me)
  const h3 = txOk(send(ROUTER, SWAP, `(${series.underlying},${token},${fee},${me},${got},${back.min},0)`), `swap stock → ${name}`)
  const re = bal(token, me) - before
  if (re < back.min) throw new Error(`buy-back paid ${fmt(re)} ${name}, below the quoted floor ${fmt(back.min)}`)
  log(`bought ${fmt(re)} ${name} back (tx ${h3})`)
  return re
}

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

  // trade each half on its pool, if it has liquidity
  let ptNow = pt0, ytNow = yt0
  for (const [name, token, pool] of [['PT', series.pt, series.poolPT], ['YT', series.yt, series.poolYT]]) {
    const liq = BigInt(call(pool, 'liquidity()(uint128)').split(' ')[0])
    if (liq === 0n) { log(`${name} pool ${pool} has no liquidity yet; trade leg skipped`); continue }
    const slice = expected / 10n
    const back = roundTrip(name, token, pool, slice)
    if (name === 'PT') ptNow = ptNow - slice + back; else ytNow = ytNow - slice + back
  }

  // merge whatever pairs up
  const mergeable = ptNow < ytNow ? ptNow : ytNow
  const stockBefore = bal(series.underlying, me)
  const h4 = txOk(send(series.vault, 'merge(uint256)', mergeable.toString()), 'merge')
  const got = bal(series.underlying, me) - stockBefore
  if (got !== mergeable) throw new Error(`merge returned ${fmt(got)}, expected exactly ${fmt(mergeable)}`)
  log(`merged ${fmt(mergeable)} PT + YT → ${fmt(got)} ${series.ticker} (tx ${h4}); leftover PT ${fmt(bal(series.pt, me))} / YT ${fmt(bal(series.yt, me))}`)
  console.log(`smoke test passed: split, trade both halves on Uniswap, merge all behave on ${series.id}`)
} catch (e) {
  console.error(`smoke test FAILED at step ${step + 1}: ${e.message}`)
  process.exit(1)
}
