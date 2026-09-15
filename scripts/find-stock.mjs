#!/usr/bin/env node
/**
 * Finds and verifies a Robinhood Chain stock token by ticker.
 *   node scripts/find-stock.mjs JEPI            # print the address and what verified it
 *   node scripts/find-stock.mjs JEPI --write    # also set STOCK=… in .env.mainnet
 *   RPC_URL=… to override the RPC (default: Robinhood Chain mainnet)
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { formatEther } from 'viem'
import { CHAIN_ID, describeShape, fetchRegistry, listRegistry, resolveStock, setEnvValue } from './lib/find-stock.mjs'

const args = process.argv.slice(2)
const rpc = process.env.RPC_URL ?? 'https://rpc.mainnet.chain.robinhood.com'

// --list: every token the registry has on chain 4663; --dump: the raw first page, for diagnosing the shape
if (args.includes('--list') || args.includes('--dump')) {
  const pages = await fetchRegistry()
  if (args.includes('--dump')) { console.log(JSON.stringify(pages[0], null, 1).slice(0, 6000)); process.exit(0) }
  const listed = listRegistry(pages)
  if (listed.length === 0) { console.log(`no recognisable token entries (${describeShape(pages[0])}); try --dump`); process.exit(1) }
  console.log(`${listed.length} tokens in Robinhood's registry on chain ${CHAIN_ID}:`)
  for (const c of listed) console.log(`  ${c.symbol.padEnd(8)} ${c.address}`)
  process.exit(0)
}

const ticker = args[0]
if (!ticker || ticker.startsWith('--')) { console.error('usage: node scripts/find-stock.mjs <TICKER> [--write] | --list | --dump'); process.exit(2) }
const write = args.includes('--write')

const r = await resolveStock(ticker, rpc, (m) => console.log(`  · ${m}`))
if (!r.ok) {
  console.error(`\n✗ ${r.reason}`)
  for (const t of r.tried) console.error(`  ${t.source} ${t.address}: ${t.ok ? 'ok' : t.reason}`)
  process.exit(1)
}
console.log(`\n✓ ${ticker} → ${r.address}`)
console.log(`  symbol ${r.symbol} · decimals ${r.decimals} · uiMultiplier ${formatEther(r.multiplier)} · via ${r.source} (${r.note})`)
if (write) {
  const file = resolve(new URL('..', import.meta.url).pathname, '.env.mainnet')
  const text = existsSync(file) ? readFileSync(file, 'utf8') : ''
  writeFileSync(file, setEnvValue(text, 'STOCK', r.address))
  console.log(`  written to .env.mainnet as STOCK=${r.address}`)
}
