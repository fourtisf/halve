#!/usr/bin/env node
/**
 * Mainnet preflight: proves the RPC, the chain id and every address in series.json answer the calls
 * the app makes, before MOCK is switched off. Run on the machine that serves the site:
 *   pnpm check:live            (uses NEXT_PUBLIC_RPC_URL or the default Robinhood Chain RPC)
 * Exit code 1 when anything the app depends on fails.
 */
import { readFileSync } from 'node:fs'
import { createPublicClient, http, parseAbi, zeroAddress } from 'viem'

const CHAIN_ID = Number(process.env.CHAIN_ID || process.env.NEXT_PUBLIC_CHAIN_ID || 4663)
const RPC = process.env.NEXT_PUBLIC_RPC_URL || 'https://rpc.mainnet.chain.robinhood.com'
const MULTICALL3 = '0xca11bde05977b3631167028862be2a173976ca11'
// what the Trade tab needs (src/lib/chain.ts defaults; the app degrades to "No route yet" without them)
const UNISWAP = {
  router: process.env.NEXT_PUBLIC_UNISWAP_ROUTER || '0xcaf681a66d020601342297493863e78c959e5cb2',
  quoter: process.env.NEXT_PUBLIC_UNISWAP_QUOTER || '0x33e885ed0ec9bf04ecfb19341582aadcb4c8a9e7',
  npm: process.env.NEXT_PUBLIC_UNISWAP_NPM || '0x73991a25c818bf1f1128deaab1492d45638de0d3',
  weth: process.env.NEXT_PUBLIC_WETH || '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73',
}
const series = JSON.parse(readFileSync(new URL('../src/contracts/series.json', import.meta.url), 'utf8'))

const abi = parseAbi([
  'function totalDeposits() view returns (uint256)',
  'function cap() view returns (uint256)',
  'function d0() view returns (uint256)',
  'function state() view returns (uint8)',
  'function dividendIndex() view returns (uint256)',
  'function splitFactor() view returns (uint256)',
  'function isSynced() view returns (bool)',
  'function checkpointCount() view returns (uint256)',
  'function pending() view returns (bool exists, uint64 ts, uint256 oldMultiplier, uint256 newMultiplier)',
  'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 a, uint16 b, uint16 c, uint8 d, bool e)',
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function latestRoundData() view returns (uint80, int256 answer, uint256, uint256, uint80)',
  'function uiMultiplier() view returns (uint256)',
  'function liquidity() view returns (uint128)',
])

const client = createPublicClient({ transport: http(RPC) })
let failures = 0
const ok = (label, value) => console.log(`  ✓ ${label}${value !== undefined ? `  → ${value}` : ''}`)
const bad = (label, err) => { failures++; console.log(`  ✗ ${label}  → ${err?.shortMessage ?? err?.message ?? err}`) }
let warnings = 0
const warn = (label, msg) => { warnings++; console.log(`  ! ${label}  → ${msg}`) }

async function call(label, address, functionName, args = []) {
  try {
    const v = await client.readContract({ address, abi, functionName, args })
    ok(label, typeof v === 'bigint' ? v.toString() : Array.isArray(v) ? JSON.stringify(v, (_, x) => (typeof x === 'bigint' ? x.toString() : x)) : String(v))
    return v
  } catch (e) {
    bad(label, e)
    return undefined
  }
}

async function hasCode(label, address) {
  if (address === zeroAddress) { bad(label, 'placeholder 0x000… address'); return false }
  const code = await client.getCode({ address }).catch(() => undefined)
  if (!code || code === '0x') { bad(label, 'no contract code at this address'); return false }
  ok(label, address)
  return true
}

console.log(`RPC ${RPC}`)
try {
  const id = await client.getChainId()
  if (id === CHAIN_ID) ok('chain id', id); else bad('chain id', `got ${id}, expected ${CHAIN_ID}`)
  const block = await client.getBlockNumber(); ok('latest block', block.toString())
  await hasCode('multicall3', MULTICALL3)
  for (const [k, a] of Object.entries(UNISWAP)) {
    const code = await client.getCode({ address: a }).catch(() => undefined)
    if (code && code !== '0x') ok(`uniswap ${k} has code`, a); else warn(`uniswap ${k}`, `no code at ${a}: market buys / sells and limit orders show "No route yet" (NEXT_PUBLIC_UNISWAP_* to override)`)
  }
} catch (e) { bad('RPC reachable', e); console.log('\nCannot reach the RPC; nothing else can be checked.'); process.exit(1) }

for (const s of series) {
  console.log(`\n${s.id}`)
  const live = ['underlying', 'vault', 'pt', 'yt', 'accountant', 'poolPT', 'poolYT'].every((k) => s[k] !== zeroAddress)
  if (!live) { console.log('  · placeholder addresses — still mocked in the app'); continue }
  const codes = await Promise.all(['underlying', 'vault', 'pt', 'yt', 'accountant', 'poolPT', 'poolYT'].map((k) => hasCode(`${k} has code`, s[k])))
  if (codes.some((c) => !c)) continue
  await call('underlying.symbol', s.underlying, 'symbol')
  await call('underlying.decimals', s.underlying, 'decimals')
  await call('underlying.uiMultiplier (ERC-8056)', s.underlying, 'uiMultiplier')
  const quote = s.underlying
  await call('vault.totalDeposits', s.vault, 'totalDeposits')
  await call('vault.cap', s.vault, 'cap')
  await call('vault.d0', s.vault, 'd0')
  await call('vault.state', s.vault, 'state')
  await call('accountant.dividendIndex', s.accountant, 'dividendIndex')
  await call('accountant.splitFactor', s.accountant, 'splitFactor')
  await call('accountant.isSynced', s.accountant, 'isSynced')
  await call('accountant.checkpointCount (optional; app probes checkpointAt if absent)', s.accountant, 'checkpointCount')
  await call('accountant.pending', s.accountant, 'pending')
  for (const [k, tok] of [['poolPT', s.pt], ['poolYT', s.yt]]) {
    const t0 = await call(`${k}.token0`, s[k], 'token0')
    const t1 = await call(`${k}.token1`, s[k], 'token1')
    const pair = [t0, t1].map((a) => a?.toLowerCase())
    if (t0 && t1) {
      if (pair.includes(tok.toLowerCase()) && pair.includes(quote.toLowerCase())) ok(`${k} pairs ${k === 'poolPT' ? 'PT' : 'YT'} with the stock`)
      else bad(`${k} pair`, `pool tokens ${t0}/${t1} are not ${tok} + ${quote}`)
    }
    await call(`${k}.slot0`, s[k], 'slot0')
    const liq = await call(`${k}.liquidity`, s[k], 'liquidity')
    if (liq === 0n) warn(`${k} liquidity`, 'the pool is empty: no price and nothing to buy until it is seeded (SEED_AMOUNT, or a position minted on Uniswap)')
  }
  if (s.priceFeed !== zeroAddress) {
    const r = await call('priceFeed.latestRoundData', s.priceFeed, 'latestRoundData')
    if (r && r[1] <= 0n) warn('priceFeed', `answer ${r[1]} is not positive; the app falls back to the market feed`)
  } else warn('priceFeed', 'none set: USD values come from the market feed (share price × uiMultiplier)')
}

console.log(failures ? `\n${failures} check(s) failed${warnings ? `, ${warnings} warning(s)` : ''}.` : `\nAll checks passed${warnings ? ` with ${warnings} warning(s) above` : ''} — safe to set MOCK=false.`)
process.exit(failures ? 1 : 0)
