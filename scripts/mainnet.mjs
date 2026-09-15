#!/usr/bin/env node
/**
 * Mainnet (or testnet) deployment of one Halve series, end to end, run on the machine that holds the key:
 *   1. preflight: the env file's values, the series.json target, chain id, deployer gas, the stock token
 *      (symbol, decimals, uiMultiplier), the price feed, the position manager and its fee tier
 *   2. DeploySeries.s.sol            → accountant + vault + PT/YT, recorded in series.json at once
 *   3. CreatePools.s.sol[:SeedPools] → Uniswap v3 PT/stock + YT/stock pools, seeded when SEED_AMOUNT is set
 *   4. pnpm check:live, then Blockscout verification (best effort, never fails the run)
 *
 *   cp .env.mainnet.example .env.mainnet   # fill it in (never commit it)
 *   node scripts/mainnet.mjs --dry-run     # simulate every step, broadcast nothing
 *   node scripts/mainnet.mjs               # for real
 *   node scripts/mainnet.mjs --resume-pools  # the vault is deployed and recorded, only the pools are missing
 *   node scripts/mainnet.mjs --force       # redeploy a series that series.json already lists as deployed
 *
 * Signing: WALLET_ARGS="--account halve --password-file /root/.halve.pass" (see `cast wallet import`) or
 * WALLET_ARGS="--ledger". DEPLOYER_KEY=0x… is refused against a remote chain (it would sit on the command line).
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createPublicClient, formatEther, http, isAddress, parseAbi, parseEther } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { fetchRegistry, listRegistry, resolveStock, setEnvValue } from './lib/find-stock.mjs'
import { loadEnv, refusePlaintextKey, uintOrNull, walletArgsFrom } from './lib/env.mjs'

const root = resolve(new URL('..', import.meta.url).pathname)
const contracts = resolve(root, 'contracts')
const flags = new Set(process.argv.slice(2))
const dryRun = flags.has('--dry-run')
const force = flags.has('--force')
const resumePools = flags.has('--resume-pools')

// .env.mainnet (KEY=value lines, inline # comments allowed) + the process environment; the latter wins
const envFile = resolve(root, process.env.MAINNET_ENV ?? '.env.mainnet')
const env = loadEnv(envFile)
const need = (k) => { if (!env[k]) { console.error(`missing ${k} (set it in .env.mainnet)`); process.exit(2) } return env[k] }
const RPC = env.RPC_URL ?? 'https://rpc.mainnet.chain.robinhood.com'
const CHAIN_ID = Number(env.CHAIN_ID ?? 4663)
const TICKER = need('TICKER'); const MATURITY = need('MATURITY'); const CAP = need('CAP')
let STOCK = env.STOCK ?? ''
const TREASURY = need('TREASURY'); const GUARDIAN = need('GUARDIAN'); const OWNER = need('OWNER')
const PRICE_FEED = env.PRICE_FEED ?? ''
const NPM = env.NPM ?? ''
const FEE = env.FEE ?? '3000'
const PT_PRICE = env.PT_PRICE ?? '960000000000000000'
const YT_PRICE = env.YT_PRICE ?? '40000000000000000'
const VERIFY = env.VERIFY === '1' || env.VERIFY === 'true'
const VERIFIER_URL = env.VERIFIER_URL ?? 'https://robinhoodchain.blockscout.com/api/'
const walletArgs = walletArgsFrom(env)
refusePlaintextKey(env, RPC)
if (!walletArgs) { console.error('set WALLET_ARGS (keystore) or DEPLOYER_KEY in .env.mainnet'); process.exit(2) }
const bin = (name) => (env.FOUNDRY_BIN ? resolve(env.FOUNDRY_BIN, name) : name)
const outDir = resolve(contracts, 'deployments'); mkdirSync(outDir, { recursive: true })
const out = (name) => resolve(outDir, `${TICKER}.${name}${dryRun ? '.dryrun' : ''}.json`)
const placeholder = (a) => !a || /^0x0+$/i.test(a)
const WAD = 10n ** 18n

const stockAbi = parseAbi(['function uiMultiplier() view returns (uint256)', 'function symbol() view returns (string)', 'function decimals() view returns (uint8)', 'function balanceOf(address) view returns (uint256)'])
const feedAbi = parseAbi(['function latestRoundData() view returns (uint80, int256, uint256, uint256, uint80)', 'function decimals() view returns (uint8)'])
const npmAbi = parseAbi(['function factory() view returns (address)'])
const factoryAbi = parseAbi(['function feeAmountTickSpacing(uint24) view returns (int24)'])
const acctAbi = parseAbi(['function stock() view returns (address)', 'function isSynced() view returns (bool)'])
const client = createPublicClient({ transport: http(RPC) })
let failures = 0
const ok = (l, v) => console.log(`  ✓ ${l}${v !== undefined ? `  → ${v}` : ''}`)
const bad = (l, e) => { failures++; console.log(`  ✗ ${l}  → ${e?.shortMessage ?? e?.message ?? e}`) }
const note = (m) => console.log(`  · ${m}`)

console.log(`\nPreflight on ${RPC}${dryRun ? ' (dry run)' : ''}${resumePools ? ' (resume: pools only)' : ''}`)

// ---- 1. the file's values, before touching the network
for (const [k, v] of [['MATURITY', MATURITY], ['CAP', CAP], ['SEED_AMOUNT', env.SEED_AMOUNT], ['FEE', FEE], ['PT_PRICE', PT_PRICE], ['YT_PRICE', YT_PRICE]]) {
  if (v === undefined) continue
  if (uintOrNull(v)) ok(`${k} is a whole number`, v); else bad(k, `not a whole number: "${v}" (raw units, no decimals)`)
}
if (env.VERIFY !== undefined && !['0', '1', 'true', 'false'].includes(env.VERIFY)) bad('VERIFY', `must be 1 or 0, got "${env.VERIFY}"`)
if (uintOrNull(MATURITY) && Number(MATURITY) <= Date.now() / 1000) bad('MATURITY', 'is in the past')
if (uintOrNull(PT_PRICE) && uintOrNull(YT_PRICE)) {
  const sum = BigInt(PT_PRICE) + BigInt(YT_PRICE)
  const off = sum > WAD ? sum - WAD : WAD - sum
  if (off <= WAD / 100n) ok('PT_PRICE + YT_PRICE ≈ 1 share', formatEther(sum)); else bad('PT_PRICE + YT_PRICE', `${formatEther(sum)}: the two halves must add up to one share, or the seed is a free split / merge arbitrage`)
}
if (env.SEED_AMOUNT && uintOrNull(env.SEED_AMOUNT) && uintOrNull(CAP)) {
  const seed = BigInt(env.SEED_AMOUNT)
  const base = seed - (seed * 10n) / 10_000n
  if (base <= BigInt(CAP)) ok('SEED_AMOUNT fits under CAP'); else bad('SEED_AMOUNT', `${env.SEED_AMOUNT} minus the split fee exceeds CAP ${CAP}`)
}
if (failures) { console.error(`\n${failures} value(s) in .env.mainnet are wrong; nothing deployed.`); process.exit(1) }

// ---- 2. STOCK empty or a placeholder → look the token up by ticker (Robinhood registry), verify it on-chain, pin it
if (!isAddress(STOCK)) {
  note(`STOCK is ${STOCK ? `not an address ("${STOCK}")` : 'empty'}; resolving ${TICKER} by ticker`)
  const r = await resolveStock(TICKER, RPC, (m) => console.log(`    ${m}`))
  if (r.ok) {
    STOCK = r.address
    if (existsSync(envFile)) writeFileSync(envFile, setEnvValue(readFileSync(envFile, 'utf8'), 'STOCK', STOCK))
    ok(`STOCK resolved for ${TICKER}`, `${STOCK} (symbol ${r.symbol}, uiMultiplier ${formatEther(r.multiplier)}, via ${r.source}; pinned in .env.mainnet)`)
  } else {
    bad('STOCK', `${r.reason}. Set STOCK=0x… in .env.mainnet yourself after checking the token on the explorer.`)
    try {
      const listed = listRegistry(await fetchRegistry())
      const ours = JSON.parse(readFileSync(resolve(root, 'src/contracts/series.json'), 'utf8')).map((s) => s.ticker)
      const both = listed.filter((c) => ours.includes(c.symbol.toUpperCase()))
      if (both.length) note(`tickers that exist both on chain and in series.json: ${both.map((c) => c.symbol).join(', ')} → set TICKER and SERIES_ID in .env.mainnet to one of them`)
    } catch { /* registry already reported above */ }
  }
}
// addresses next, so a placeholder left in .env.mainnet is named instead of surfacing as an RPC error
for (const [k, v, optional] of [['STOCK', STOCK], ['TREASURY', TREASURY], ['GUARDIAN', GUARDIAN], ['OWNER', OWNER], ['PRICE_FEED', PRICE_FEED, true], ['NPM', NPM, true], ['ACCOUNTANT', env.ACCOUNTANT ?? '', true]]) {
  if (optional && !v) continue
  if (isAddress(v)) ok(`${k} is an address`, v); else bad(k, `not a valid address: "${v}" (edit .env.mainnet)`)
}
if (failures) { console.error(`\n${failures} value(s) in .env.mainnet are wrong; nothing deployed.`); process.exit(1) }

// ---- 3. the series.json target: it must exist, and must not already be deployed (a second run = a second vault)
const seriesPath = resolve(root, 'src/contracts/series.json')
const seriesAll = JSON.parse(readFileSync(seriesPath, 'utf8'))
const target = seriesAll.find((s) => (env.SERIES_ID ? s.id === env.SERIES_ID : s.ticker === TICKER))
if (!target) bad('series.json', `no series with ${env.SERIES_ID ? `id ${env.SERIES_ID}` : `ticker ${TICKER}`}: add it (id, ticker, name, issuer, decimals, maturity, cap) before deploying, or set SERIES_ID`)
else {
  ok('series.json target', target.id)
  if (!placeholder(target.vault) && !resumePools && !force) bad('series.json', `${target.id} already lists vault ${target.vault}; another run would deploy a second vault. Finish its pools with --resume-pools, or redeploy on purpose with --force.`)
  if (resumePools && placeholder(target.vault)) bad('--resume-pools', `${target.id} has no vault recorded yet; run without the flag`)
  if (resumePools && !placeholder(target.poolPT) && !force) bad('--resume-pools', `${target.id} already lists pools ${target.poolPT} / ${target.poolYT}`)
  if (!env.ACCOUNTANT && !resumePools) {
    const sibling = seriesAll.find((s) => s !== target && !placeholder(s.accountant) && (s.underlying ?? '').toLowerCase() === STOCK.toLowerCase())
    if (sibling) { env.ACCOUNTANT = sibling.accountant; note(`reusing accountant ${sibling.accountant} from ${sibling.id} (same stock token, one keeper entry)`) }
  }
}
if (failures) { console.error(`\n${failures} check(s) failed; nothing deployed.`); process.exit(1) }

// ---- 4. the chain
try {
  const id = await client.getChainId()
  if (id === CHAIN_ID) ok('chain id', id); else bad('chain id', `${id}, expected ${CHAIN_ID}`)
  const code = await client.getCode({ address: STOCK })
  if (code && code !== '0x') ok('stock has code', STOCK); else bad('stock', 'no code at STOCK')
  const sym = await client.readContract({ address: STOCK, abi: stockAbi, functionName: 'symbol' }).catch((e) => bad('stock.symbol', e))
  if (sym !== undefined) {
    if (String(sym).toUpperCase() === TICKER.toUpperCase() || env.ALLOW_SYMBOL_MISMATCH === '1') ok('stock.symbol', sym)
    else bad('stock.symbol', `${sym} is not ${TICKER}: wrong STOCK address (ALLOW_SYMBOL_MISMATCH=1 if the token really names itself differently)`)
  }
  const dec = await client.readContract({ address: STOCK, abi: stockAbi, functionName: 'decimals' }).catch((e) => bad('stock.decimals', e))
  if (dec !== undefined) {
    const d = Number(dec)
    if (target && target.decimals !== undefined && Number(target.decimals) !== d) bad('stock.decimals', `${d}, but series.json says ${target.decimals}; CAP / SEED_AMOUNT are raw units of 10^${d}`)
    else ok('stock.decimals', `${d}${d !== 18 ? ' (CAP and SEED_AMOUNT are raw units: 1 share = 10^' + d + ')' : ''}`)
  }
  const m = await client.readContract({ address: STOCK, abi: stockAbi, functionName: 'uiMultiplier' }).catch((e) => bad('stock.uiMultiplier (ERC-8056)', e))
  if (m !== undefined) { if (m > 0n) ok('stock.uiMultiplier', m.toString()); else bad('stock.uiMultiplier', 'is zero') }
  if (PRICE_FEED) {
    const r = await client.readContract({ address: PRICE_FEED, abi: feedAbi, functionName: 'latestRoundData' }).catch((e) => bad('priceFeed.latestRoundData', e))
    if (r) { if (r[1] > 0n) ok('priceFeed.latestRoundData', r[1].toString()); else bad('priceFeed', `answer ${r[1]} is not positive`) }
  } else note('no PRICE_FEED: USD values come from the market feed (share price × uiMultiplier) until one is set')
  if (env.ACCOUNTANT) {
    const st = await client.readContract({ address: env.ACCOUNTANT, abi: acctAbi, functionName: 'stock' }).catch((e) => bad('accountant.stock', e))
    if (st !== undefined) { if (st.toLowerCase() === STOCK.toLowerCase()) ok('ACCOUNTANT tracks this stock'); else bad('ACCOUNTANT', `tracks ${st}, not ${STOCK}`) }
    const synced = await client.readContract({ address: env.ACCOUNTANT, abi: acctAbi, functionName: 'isSynced' }).catch((e) => bad('accountant.isSynced', e))
    if (synced === false) bad('ACCOUNTANT', 'is holding a change for the guardian; the vault cannot be created until it is resolved')
  }
  if (NPM) {
    const c = await client.getCode({ address: NPM })
    if (c && c !== '0x') ok('position manager has code', NPM); else bad('NPM', 'no code at NPM')
    const factory = await client.readContract({ address: NPM, abi: npmAbi, functionName: 'factory' }).catch((e) => bad('NPM.factory (is this really the position manager?)', e))
    if (factory) {
      const spacing = await client.readContract({ address: factory, abi: factoryAbi, functionName: 'feeAmountTickSpacing', args: [Number(FEE)] }).catch((e) => bad('factory.feeAmountTickSpacing', e))
      if (spacing !== undefined) { if (Number(spacing) !== 0) ok(`fee tier ${FEE} enabled`, `tick spacing ${spacing}`); else bad('FEE', `${FEE} is not an enabled fee tier on this factory (use 500, 3000 or 10000)`) }
    }
  } else note('no NPM: pools are skipped; the app keeps the series in demo mode until poolPT / poolYT are filled')
  // deployer address: from the key, or from the keystore / ledger via `cast wallet address`
  let deployer = env.DEPLOYER_KEY ? privateKeyToAccount(env.DEPLOYER_KEY).address : null
  if (!deployer && env.WALLET_ARGS) {
    const r = spawnSync(bin('cast'), ['wallet', 'address', ...walletArgs], { encoding: 'utf8' })
    deployer = r.status === 0 ? r.stdout.trim() : null
    if (!deployer) bad('deployer', `cast wallet address failed: ${(r.stderr || '').trim().split('\n')[0]}`)
  }
  if (deployer) {
    const minGas = parseEther(env.MIN_GAS_ETH ?? '0.02')
    const bal = await client.getBalance({ address: deployer })
    if (bal >= minGas) ok(`deployer ${deployer} balance`, `${formatEther(bal)} ETH`); else bad('deployer balance', `${deployer} has ${formatEther(bal)} ETH, needs at least ${formatEther(minGas)} for the whole run (MIN_GAS_ETH to change)`)
    if (env.SEED_AMOUNT && !resumePools) {
      const sb = await client.readContract({ address: STOCK, abi: stockAbi, functionName: 'balanceOf', args: [deployer] })
      if (sb >= 2n * BigInt(env.SEED_AMOUNT)) ok('deployer stock for seeding', sb.toString()); else bad('deployer stock', `needs 2 × SEED_AMOUNT = ${2n * BigInt(env.SEED_AMOUNT)}, has ${sb}`)
    }
  }
} catch (e) { bad('RPC', e) }
if (failures) { console.error(`\n${failures} preflight check(s) failed; nothing deployed.`); process.exit(1) }

// ---- the run
function forge(script, extraEnv, { broadcast = !dryRun, extra = [] } = {}) {
  const args = ['script', script, '--rpc-url', RPC, ...walletArgs, ...(broadcast ? ['--broadcast'] : []), ...extra]
  const r = spawnSync(bin('forge'), args, { cwd: contracts, stdio: 'inherit', env: { ...env, ...extraEnv } })
  return r.status ?? 1
}
function apply(files) {
  const r = spawnSync(process.execPath, [resolve(root, 'scripts/apply-deployment.mjs'), '--ticker', TICKER, ...(env.SERIES_ID ? ['--id', env.SERIES_ID] : []), ...files], { stdio: 'inherit' })
  if (r.status !== 0) { console.error('\ncould not write series.json; the addresses are in ' + files.join(', ')); process.exit(r.status ?? 1) }
}

const deployEnv = { STOCK, TICKER, MATURITY, CAP, TREASURY, GUARDIAN, OWNER, PRICE_FEED: PRICE_FEED || '0x0000000000000000000000000000000000000000', ACCOUNTANT: env.ACCOUNTANT ?? '', OUT: out('series') }
let vault = target.vault
if (resumePools) {
  console.log(`\n1/3 series: already deployed (${vault}), resuming at the pools`)
} else {
  console.log('\n1/3 series (accountant + vault + PT/YT)')
  if (forge('script/DeploySeries.s.sol', deployEnv) !== 0) { console.error('\nDeploySeries failed; nothing recorded. The forge output above names the revert.'); process.exit(1) }
  if (!dryRun) {
    vault = JSON.parse(readFileSync(out('series'), 'utf8')).vault
    apply([out('series')]) // recorded before the pools, so a failure there never loses the addresses
  }
}

if (NPM && !dryRun) {
  console.log('\n2/3 pools (quoted in the stock token: raw balances never rebase, so Uniswap v3 is fine with it)')
  const poolEnv = { NPM, VAULT: vault, QUOTE: STOCK, FEE, PT_PRICE, YT_PRICE, OUT: out('pools') }
  const status = env.SEED_AMOUNT ? forge('script/CreatePools.s.sol:SeedPools', { ...poolEnv, AMOUNT: env.SEED_AMOUNT }) : forge('script/CreatePools.s.sol', poolEnv)
  if (status !== 0) {
    console.error(`\nPools failed. The series is deployed and recorded in series.json; fix the cause named above (the vault cap, the token refusing a transfer, a pool somebody created first) and finish with:\n  node scripts/mainnet.mjs --resume-pools`)
    process.exit(1)
  }
  apply([out('pools')])
} else if (NPM) console.log('\n2/3 pools: skipped in dry run (needs the deployed vault)')

if (!dryRun) {
  console.log('\n3/3 preflight of the app reads')
  const check = spawnSync(process.execPath, [resolve(root, 'scripts/check-live.mjs')], { stdio: 'inherit', env: { ...process.env, NEXT_PUBLIC_RPC_URL: RPC, CHAIN_ID: String(CHAIN_ID), NEXT_PUBLIC_UNISWAP_NPM: NPM || '' } })
  if (VERIFY && !resumePools) {
    console.log('\nVerifying sources on Blockscout (best effort; the deployment is already complete)')
    const v = forge('script/DeploySeries.s.sol', deployEnv, { broadcast: false, extra: ['--resume', '--verify', '--verifier', 'blockscout', '--verifier-url', VERIFIER_URL] })
    if (v !== 0) console.log('  verification did not complete; retry later with the same command and --resume --verify, nothing else changes')
  }
  console.log(check.status === 0
    ? '\nDone. Commit src/contracts/series.json, then on the server: MOCK=false in .env.local, pnpm build, pm2 restart halve.'
    : '\nDeployed and recorded, but the app preflight found problems above. Fix them (pools, feed) before switching MOCK off.')
} else console.log('\nDry run finished: every script simulated, nothing broadcast, series.json untouched.')
