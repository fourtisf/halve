/**
 * Resolves a Robinhood Chain stock token address from its ticker, then verifies it on-chain.
 * Sources, in order: Robinhood's public asset registry (api.robinhood.com/rhj/assets), then the
 * Blockscout token search. Every candidate must answer symbol() and uiMultiplier() (ERC-8056) on the RPC.
 */
import { createPublicClient, http, isAddress, parseAbi } from 'viem'

export const CHAIN_ID = 4663
export const REGISTRY_URL = 'https://api.robinhood.com/rhj/assets'
export const BLOCKSCOUT_URL = 'https://robinhoodchain.blockscout.com/api/v2/tokens'
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/
const SYMBOL_KEYS = ['symbol', 'ticker', 'tokenSymbol', 'token_symbol']
const ADDRESS_KEYS = ['contractAddress', 'contract_address', 'tokenAddress', 'token_address', 'address', 'contract']
const CHAIN_KEYS = ['chainId', 'chain_id', 'chainID', 'networkId', 'network_id']
const NETWORK_KEYS = ['network', 'chain', 'chainName', 'chain_name']

const norm = (s) => String(s).toUpperCase().replace(/[^A-Z0-9]/g, '')

/** "JEPI" matches JEPI, jepi, JEPIx, JEPI-x, "JEPI Token"? no — only the symbol itself or a one-letter suffix. */
export function symbolMatches(symbol, ticker) {
  if (typeof symbol !== 'string') return false
  const a = norm(symbol), b = norm(ticker)
  return a === b || (a.startsWith(b) && a.length === b.length + 1)
}

/**
 * Walks any JSON shape and returns [{ symbol, address, chainId }] for objects whose symbol matches the
 * ticker. Chain ids come from chainId-like fields, from numeric object keys ({ "4663": { address } }) or
 * from a network name containing "robinhood".
 */
export function findCandidates(json, ticker) {
  const out = []
  const seen = new Set()
  const walk = (node, ctx) => {
    if (Array.isArray(node)) { for (const n of node) walk(n, ctx); return }
    if (!node || typeof node !== 'object') return
    const sym = SYMBOL_KEYS.map((k) => node[k]).find((v) => typeof v === 'string')
    let chain = CHAIN_KEYS.map((k) => node[k]).find((v) => v !== undefined && v !== null)
    if (chain === undefined) {
      const net = NETWORK_KEYS.map((k) => node[k]).find((v) => typeof v === 'string')
      if (net && /robinhood/i.test(net)) chain = CHAIN_ID
    }
    const next = { symbol: sym ?? ctx?.symbol, chainId: chain !== undefined ? Number(chain) : ctx?.chainId }
    if (next.symbol && symbolMatches(next.symbol, ticker)) {
      const addr = ADDRESS_KEYS.map((k) => node[k]).find((v) => typeof v === 'string' && ADDRESS_RE.test(v))
      if (addr) {
        const key = `${addr.toLowerCase()}:${next.chainId ?? ''}`
        if (!seen.has(key)) { seen.add(key); out.push({ symbol: next.symbol, address: addr, chainId: next.chainId }) }
      }
    }
    for (const [k, v] of Object.entries(node)) walk(v, /^\d+$/.test(k) ? { ...next, chainId: Number(k) } : next)
  }
  walk(json, null)
  return out
}

/** Picks the address to use: the one on chain 4663, else the only candidate without chain info. */
export function pickCandidate(candidates) {
  const onChain = candidates.filter((c) => c.chainId === CHAIN_ID)
  if (onChain.length === 1) return { address: onChain[0].address, symbol: onChain[0].symbol, why: 'registry entry on chain 4663' }
  if (onChain.length > 1) return { ambiguous: onChain }
  const noChain = candidates.filter((c) => c.chainId === undefined)
  const unique = [...new Set(noChain.map((c) => c.address.toLowerCase()))]
  if (unique.length === 1) return { address: noChain[0].address, symbol: noChain[0].symbol, why: 'registry entry (no chain id given)' }
  if (unique.length > 1) return { ambiguous: noChain }
  return null
}

const stockAbi = parseAbi(['function symbol() view returns (string)', 'function decimals() view returns (uint8)', 'function uiMultiplier() view returns (uint256)'])

/** Proves the address is an ERC-8056 stock token whose symbol matches the ticker. */
export async function verifyStock(rpc, address, ticker) {
  if (!isAddress(address)) return { ok: false, reason: 'not an address' }
  const client = createPublicClient({ transport: http(rpc) })
  const code = await client.getCode({ address }).catch(() => undefined)
  if (!code || code === '0x') return { ok: false, reason: 'no contract code' }
  let symbol, decimals, multiplier
  try { symbol = await client.readContract({ address, abi: stockAbi, functionName: 'symbol' }) } catch { return { ok: false, reason: 'symbol() failed' } }
  try { decimals = await client.readContract({ address, abi: stockAbi, functionName: 'decimals' }) } catch { return { ok: false, reason: 'decimals() failed' } }
  try { multiplier = await client.readContract({ address, abi: stockAbi, functionName: 'uiMultiplier' }) } catch { return { ok: false, reason: `uiMultiplier() failed (not ERC-8056), symbol ${symbol}` } }
  if (!symbolMatches(symbol, ticker)) return { ok: false, reason: `symbol is ${symbol}, expected ${ticker}`, symbol }
  return { ok: true, symbol, decimals: Number(decimals), multiplier }
}

async function getJson(url) {
  const r = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'halve-deploy/1.0' } })
  if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`)
  return r.json()
}

/** Robinhood's registry, following `next` pagination when present. */
export async function fetchRegistry(url = REGISTRY_URL, maxPages = 30) {
  const pages = []
  let next = url
  for (let i = 0; i < maxPages && next; i++) {
    const j = await getJson(next)
    pages.push(j)
    next = typeof j?.next === 'string' && j.next.startsWith('http') ? j.next : null
  }
  return pages
}

/** Blockscout token search: every ERC-20 whose symbol matches, most holders first. */
export async function fetchBlockscout(ticker, url = BLOCKSCOUT_URL) {
  const j = await getJson(`${url}?q=${encodeURIComponent(ticker)}&type=ERC-20`)
  const items = Array.isArray(j?.items) ? j.items : []
  return items
    .filter((t) => t && ADDRESS_RE.test(t.address ?? '') && symbolMatches(t.symbol, ticker))
    .sort((a, b) => Number(b.holders ?? 0) - Number(a.holders ?? 0))
    .map((t) => ({ symbol: t.symbol, address: t.address, holders: Number(t.holders ?? 0), name: t.name }))
}

/**
 * Full resolution: registry → verify; else Blockscout → verify each; returns
 * { ok, address, symbol, source, note } or { ok: false, reason, tried }.
 */
export async function resolveStock(ticker, rpc, log = () => {}) {
  const tried = []
  try {
    const pages = await fetchRegistry()
    const candidates = pages.flatMap((p) => findCandidates(p, ticker))
    const pick = pickCandidate(candidates)
    if (pick?.address) {
      const v = await verifyStock(rpc, pick.address, ticker)
      tried.push({ source: 'registry', address: pick.address, ...v })
      if (v.ok) return { ok: true, address: pick.address, symbol: v.symbol, decimals: v.decimals, multiplier: v.multiplier, source: 'Robinhood asset registry', note: pick.why }
      log(`registry gave ${pick.address} but it failed verification: ${v.reason}`)
    } else if (pick?.ambiguous) log(`registry lists several ${ticker} deployments: ${pick.ambiguous.map((c) => `${c.address} (chain ${c.chainId ?? '?'})`).join(', ')}`)
    else log(`registry has no entry for ${ticker}`)
  } catch (e) { log(`registry unavailable: ${e.message}`) }
  try {
    const items = await fetchBlockscout(ticker)
    if (items.length === 0) log(`Blockscout has no ERC-20 with symbol ${ticker}`)
    for (const it of items) {
      const v = await verifyStock(rpc, it.address, ticker)
      tried.push({ source: 'blockscout', address: it.address, holders: it.holders, ...v })
      if (v.ok) return { ok: true, address: it.address, symbol: v.symbol, decimals: v.decimals, multiplier: v.multiplier, source: 'Blockscout token search', note: `${it.holders} holders; confirm it is the Robinhood-issued token on the explorer` }
      log(`Blockscout candidate ${it.address} rejected: ${v.reason}`)
    }
  } catch (e) { log(`Blockscout unavailable: ${e.message}`) }
  return { ok: false, reason: `no verified ${ticker} stock token found`, tried }
}

/** Replaces or appends KEY=value in an env file. */
export function setEnvValue(text, key, value) {
  const line = `${key}=${value}`
  const re = new RegExp(`^${key}=.*$`, 'm')
  return re.test(text) ? text.replace(re, line) : text.replace(/\n?$/, '\n') + line + '\n'
}
