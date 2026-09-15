#!/usr/bin/env node
/**
 * Mainnet (or testnet) deployment of one Halve series, end to end, run on the machine that holds the key:
 *   1. preflight: chain id, deployer balance, the stock token answers uiMultiplier(), the price feed answers
 *   2. DeploySeries.s.sol            → accountant + vault + PT/YT           (deployments/<TICKER>.series.json)
 *   3. DeployWrappedStock.s.sol      → wStock, the non-rebasing quote asset (unless WSTOCK is given or QUOTE_KIND=stock)
 *   4. CreatePools.s.sol[:SeedPools] → Uniswap v3 PT/wStock + YT/wStock pools, seeded when SEED_AMOUNT is set
 *   5. scripts/apply-deployment.mjs  → src/contracts/series.json
 *   6. pnpm check:live
 *
 *   cp .env.mainnet.example .env.mainnet   # fill it in (never commit it)
 *   node scripts/mainnet.mjs --dry-run     # simulate every step, broadcast nothing
 *   node scripts/mainnet.mjs               # for real
 *
 * Signing: DEPLOYER_KEY=0x… in .env.mainnet, or WALLET_ARGS="--account halve --password-file ~/.halve.pass"
 * (see `cast wallet import`) or WALLET_ARGS="--ledger". Never paste a key anywhere else.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createPublicClient, formatEther, http, isAddress, parseAbi } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

const root = resolve(new URL('..', import.meta.url).pathname)
const contracts = resolve(root, 'contracts')
const dryRun = process.argv.includes('--dry-run')

// .env.mainnet (KEY=value lines) + the process environment; the latter wins
const env = { ...process.env }
const envFile = resolve(root, process.env.MAINNET_ENV ?? '.env.mainnet')
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line)
    if (m && !(m[1] in process.env)) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}
const need = (k) => { if (!env[k]) { console.error(`missing ${k} (set it in .env.mainnet)`); process.exit(2) } return env[k] }
const RPC = env.RPC_URL ?? 'https://rpc.mainnet.chain.robinhood.com'
const CHAIN_ID = Number(env.CHAIN_ID ?? 4663)
const STOCK = need('STOCK'); const TICKER = need('TICKER'); const MATURITY = need('MATURITY'); const CAP = need('CAP')
const TREASURY = need('TREASURY'); const GUARDIAN = need('GUARDIAN'); const OWNER = need('OWNER')
const PRICE_FEED = env.PRICE_FEED ?? ''
const NPM = env.NPM ?? ''
const QUOTE_KIND = env.QUOTE_KIND ?? 'wrapped'
const VERIFY = env.VERIFY === '1' || env.VERIFY === 'true'
const walletArgs = env.DEPLOYER_KEY ? ['--private-key', env.DEPLOYER_KEY] : env.WALLET_ARGS ? env.WALLET_ARGS.split(/\s+/) : null
if (!walletArgs) { console.error('set DEPLOYER_KEY or WALLET_ARGS in .env.mainnet'); process.exit(2) }
const bin = (name) => (env.FOUNDRY_BIN ? resolve(env.FOUNDRY_BIN, name) : name)
const outDir = resolve(contracts, 'deployments'); mkdirSync(outDir, { recursive: true })
const out = (name) => resolve(outDir, `${TICKER}.${name}.json`)

const stockAbi = parseAbi(['function uiMultiplier() view returns (uint256)', 'function symbol() view returns (string)', 'function decimals() view returns (uint8)', 'function balanceOf(address) view returns (uint256)'])
const feedAbi = parseAbi(['function latestRoundData() view returns (uint80, int256, uint256, uint256, uint80)', 'function decimals() view returns (uint8)'])
const client = createPublicClient({ transport: http(RPC) })
let failures = 0
const ok = (l, v) => console.log(`  ✓ ${l}${v !== undefined ? `  → ${v}` : ''}`)
const bad = (l, e) => { failures++; console.log(`  ✗ ${l}  → ${e?.shortMessage ?? e?.message ?? e}`) }

console.log(`\nPreflight on ${RPC}${dryRun ? ' (dry run)' : ''}`)
// addresses first, so a placeholder left in .env.mainnet is named instead of surfacing as an RPC error
for (const [k, v, optional] of [['STOCK', STOCK], ['TREASURY', TREASURY], ['GUARDIAN', GUARDIAN], ['OWNER', OWNER], ['PRICE_FEED', PRICE_FEED, true], ['NPM', NPM, true], ['WSTOCK', env.WSTOCK ?? '', true], ['ACCOUNTANT', env.ACCOUNTANT ?? '', true]]) {
  if (optional && !v) continue
  if (isAddress(v)) ok(`${k} is an address`, v); else bad(k, `not a valid address: "${v}" (edit .env.mainnet)`)
}
if (failures) { console.error(`\n${failures} value(s) in .env.mainnet are wrong; nothing deployed.`); process.exit(1) }
try {
  const id = await client.getChainId()
  if (id === CHAIN_ID) ok('chain id', id); else bad('chain id', `${id}, expected ${CHAIN_ID}`)
  const code = await client.getCode({ address: STOCK })
  if (code && code !== '0x') ok('stock has code', STOCK); else bad('stock', 'no code at STOCK')
  const sym = await client.readContract({ address: STOCK, abi: stockAbi, functionName: 'symbol' }).catch((e) => bad('stock.symbol', e))
  if (sym) ok('stock.symbol', sym)
  const m = await client.readContract({ address: STOCK, abi: stockAbi, functionName: 'uiMultiplier' }).catch((e) => bad('stock.uiMultiplier (ERC-8056)', e))
  if (m !== undefined) ok('stock.uiMultiplier', m.toString())
  if (PRICE_FEED) {
    const r = await client.readContract({ address: PRICE_FEED, abi: feedAbi, functionName: 'latestRoundData' }).catch((e) => bad('priceFeed.latestRoundData', e))
    if (r) ok('priceFeed.latestRoundData', r[1].toString())
  } else console.log('  · no PRICE_FEED: USD values will show $0 until one is set')
  if (NPM) {
    const c = await client.getCode({ address: NPM })
    if (c && c !== '0x') ok('position manager has code', NPM); else bad('NPM', 'no code at NPM')
  }
  else console.log('  · no NPM: pools are skipped (create them later with CreatePools.s.sol)')
  // deployer address: from the key, or from the keystore / ledger via `cast wallet address`
  let deployer = env.DEPLOYER_KEY ? privateKeyToAccount(env.DEPLOYER_KEY).address : null
  if (!deployer && env.WALLET_ARGS) {
    const r = spawnSync(bin('cast'), ['wallet', 'address', ...env.WALLET_ARGS.split(/\s+/)], { encoding: 'utf8' })
    deployer = r.status === 0 ? r.stdout.trim() : null
    if (!deployer) bad('deployer', `cast wallet address failed: ${(r.stderr || '').trim().split('\n')[0]}`)
  }
  if (deployer) {
    const a = deployer
    const bal = await client.getBalance({ address: a })
    if (bal > 0n) ok(`deployer ${a} balance`, `${formatEther(bal)} ETH`); else bad('deployer balance', `${a} has no gas`)
    if (env.SEED_AMOUNT) {
      const sb = await client.readContract({ address: STOCK, abi: stockAbi, functionName: 'balanceOf', args: [a] })
      if (sb >= 2n * BigInt(env.SEED_AMOUNT)) ok('deployer stock for seeding', sb.toString()); else bad('deployer stock', `needs 2 × SEED_AMOUNT = ${2n * BigInt(env.SEED_AMOUNT)}, has ${sb}`)
    }
  }
  if (Number(MATURITY) <= Date.now() / 1000) bad('MATURITY', 'is in the past')
} catch (e) { bad('RPC', e) }
if (failures) { console.error(`\n${failures} preflight check(s) failed; nothing deployed.`); process.exit(1) }

function forge(target, extraEnv, verify = false) {
  const args = ['script', target, '--rpc-url', RPC, ...walletArgs, ...(dryRun ? [] : ['--broadcast'])]
  if (verify && !dryRun) args.push('--verify', '--verifier', 'blockscout', '--verifier-url', env.VERIFIER_URL ?? 'https://robinhoodchain.blockscout.com/api/')
  const r = spawnSync(bin('forge'), args, { cwd: contracts, stdio: 'inherit', env: { ...env, ...extraEnv } })
  if (r.status !== 0) { console.error(`\n${target} failed`); process.exit(r.status ?? 1) }
}

console.log('\n1/4 series (accountant + vault + PT/YT)')
forge('script/DeploySeries.s.sol', { STOCK, TICKER, MATURITY, CAP, TREASURY, GUARDIAN, OWNER, PRICE_FEED: PRICE_FEED || '0x0000000000000000000000000000000000000000', ACCOUNTANT: env.ACCOUNTANT ?? '', OUT: out('series') }, VERIFY)
const series = dryRun ? null : JSON.parse(readFileSync(out('series'), 'utf8'))

let wstock = env.WSTOCK ?? ''
if (QUOTE_KIND === 'wrapped' && !wstock) {
  console.log('\n2/4 wrapped stock (quote asset)')
  forge('script/DeployWrappedStock.s.sol', { STOCK, OUT: out('wrapped') }, VERIFY)
  if (!dryRun) wstock = JSON.parse(readFileSync(out('wrapped'), 'utf8')).wrappedStock
} else console.log(`\n2/4 quote asset: ${QUOTE_KIND === 'wrapped' ? `existing wStock ${wstock}` : 'the stock token itself (not recommended on Uniswap v3)'}`)

const files = [out('series')]
if (NPM && !dryRun) {
  console.log('\n3/4 pools')
  const quote = QUOTE_KIND === 'wrapped' ? wstock : STOCK
  const poolEnv = { NPM, VAULT: series.vault, QUOTE: quote, QUOTE_KIND, FEE: env.FEE ?? '3000', PT_PRICE: env.PT_PRICE ?? '960000000000000000', YT_PRICE: env.YT_PRICE ?? '40000000000000000', OUT: out('pools') }
  if (env.SEED_AMOUNT && QUOTE_KIND === 'wrapped') forge('script/CreatePools.s.sol:SeedPools', { ...poolEnv, WSTOCK: wstock, AMOUNT: env.SEED_AMOUNT })
  else forge('script/CreatePools.s.sol', poolEnv)
  files.push(out('pools'))
} else if (NPM) console.log('\n3/4 pools: skipped in dry run (needs the deployed vault)')

if (!dryRun) {
  console.log('\n4/4 series.json + preflight of the app reads')
  const apply = spawnSync(process.execPath, [resolve(root, 'scripts/apply-deployment.mjs'), '--ticker', TICKER, ...(env.SERIES_ID ? ['--id', env.SERIES_ID] : []), ...files], { stdio: 'inherit' })
  if (apply.status !== 0) process.exit(apply.status ?? 1)
  if (QUOTE_KIND === 'wrapped' && wstock) {
    const patch = resolve(outDir, `${TICKER}.quote.json`)
    writeFileSync(patch, JSON.stringify({ quote: 'wrapped', quoteToken: wstock }))
    spawnSync(process.execPath, [resolve(root, 'scripts/apply-deployment.mjs'), '--ticker', TICKER, ...(env.SERIES_ID ? ['--id', env.SERIES_ID] : []), patch], { stdio: 'inherit' })
  }
  const check = spawnSync(process.execPath, [resolve(root, 'scripts/check-live.mjs')], { stdio: 'inherit', env: { ...process.env, NEXT_PUBLIC_RPC_URL: RPC } })
  console.log(check.status === 0
    ? '\nDone. Commit src/contracts/series.json, then on the server: MOCK=false in .env.local, pnpm build, pm2 restart halve.'
    : '\nDeployed, but the app preflight found problems above. Fix them (pools, feed) before switching MOCK off.')
} else console.log('\nDry run finished: every script simulated, nothing broadcast, series.json untouched.')

