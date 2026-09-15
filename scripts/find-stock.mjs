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
import { resolveStock, setEnvValue } from './lib/find-stock.mjs'

const ticker = process.argv[2]
if (!ticker || ticker.startsWith('--')) { console.error('usage: node scripts/find-stock.mjs <TICKER> [--write]'); process.exit(2) }
const write = process.argv.includes('--write')
const rpc = process.env.RPC_URL ?? 'https://rpc.mainnet.chain.robinhood.com'

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
