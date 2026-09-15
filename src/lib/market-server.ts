/**
 * Server-side market fetch with a one-minute cache: Yahoo Finance first, Stooq for prices when Yahoo fails,
 * and the last good numbers (flagged stale) while a source is down. Read through /api/market.
 */
import { SERIES } from '@/contracts/types'
import { MARKET_OFF, parseStooqCsv, parseYahooChart, stooqCsvUrl, yahooChartUrl, HISTORY_DAYS, type MarketData, type MarketSource, type Quote } from './market'
import { MOCK_ETH_USD, mockFor } from './mock'

const MODE = (process.env.LIVE_MARKET ?? 'true').trim().toLowerCase()
/** LIVE_MARKET=false keeps the prototype's demo numbers (tests, air-gapped hosts). Default on. */
export const LIVE_MARKET = !['false', 'off', '0', 'no'].includes(MODE)
/** LIVE_MARKET=fixture serves deterministic quotes built from the demo table: the preview UI without network. */
export const MARKET_FIXTURE = MODE === 'fixture'

const TTL_MS = 60_000
const RETRY_MS = 15_000
const PARTIAL_RETRY_MS = 30_000
const TIMEOUT_MS = 8_000
const ETH = 'ETH-USD'
const UA = 'Mozilla/5.0 (X11; Linux x86_64) HalveMarket/0.1 (+https://halve.finance)'

let cache: { at: number; data: MarketData } | null = null
let inflight: Promise<MarketData> | null = null

const msg = (e: unknown): string => (e instanceof Error ? e.message : String(e)).split('\n')[0].slice(0, 120)

async function get(url: string, accept: string): Promise<Response> {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: accept }, cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res
}

async function quoteFor(symbol: string, now: number): Promise<{ q: Quote | null; source?: MarketSource; error?: string }> {
  let yahoo: string
  try {
    const q = parseYahooChart(symbol, await (await get(yahooChartUrl(symbol), 'application/json')).json(), now)
    if (q) return { q, source: 'yahoo' }
    yahoo = 'unusable response'
  } catch (e) {
    yahoo = msg(e)
  }
  if (symbol === ETH) return { q: null, error: `${symbol}: yahoo ${yahoo}` }
  try {
    const q = parseStooqCsv(symbol, await (await get(stooqCsvUrl(symbol, now), 'text/csv')).text(), now)
    return q ? { q, source: 'stooq' } : { q: null, error: `${symbol}: yahoo ${yahoo}; stooq empty` }
  } catch (e) {
    return { q: null, error: `${symbol}: yahoo ${yahoo}; stooq ${msg(e)}` }
  }
}

/** One round trip for every ticker in series.json plus ETH-USD. */
export async function fetchMarket(nowMs = Date.now()): Promise<MarketData> {
  const now = nowMs / 1000
  const tickers = [...new Set(SERIES.map((s) => s.ticker))]
  const rows = await Promise.all([...tickers, ETH].map((s) => quoteFor(s, now)))
  const quotes: Record<string, Quote> = {}
  const errors: string[] = []
  let source: MarketSource = 'off'
  rows.forEach((r, i) => {
    if (r.q && i < tickers.length) quotes[tickers[i]] = r.q
    if (r.error) errors.push(r.error)
    if (r.source === 'yahoo') source = 'yahoo'
    else if (r.source === 'stooq' && source === 'off') source = 'stooq'
  })
  const n = Object.keys(quotes).length
  return { ok: n > 0, source: n > 0 ? source : 'off', updatedAt: n > 0 ? Math.floor(now) : null, stale: false, quotes, ethUsd: rows[tickers.length]?.q?.price ?? null, errors }
}

/** Offline stand-in for the feed: the demo table's price and yield, a gentle 30-day wobble, ETH at the demo price. */
export function fixtureMarket(now = Date.now() / 1000): MarketData {
  const quotes: Record<string, Quote> = {}
  for (const t of new Set(SERIES.map((s) => s.ticker))) {
    const m = mockFor(t)
    const closes30d = Array.from({ length: HISTORY_DAYS + 1 }, (_, i) => +(m.px * (1 + 0.01 * Math.sin(i / 3) - 0.008 + (0.008 * i) / HISTORY_DAYS)).toFixed(2))
    closes30d[closes30d.length - 1] = m.px
    const prevClose = closes30d[closes30d.length - 2]
    quotes[t] = { symbol: t, price: m.px, prevClose, change24hPct: (m.px / prevClose - 1) * 100, change7dPct: (m.px / closes30d[closes30d.length - 8] - 1) * 100, closes30d, dividendsTtm: +(m.px * m.dy).toFixed(4), trailingYield: m.dy, currency: 'USD', at: Math.floor(now) }
  }
  return { ok: true, source: 'fixture', updatedAt: Math.floor(now), stale: false, quotes, ethUsd: MOCK_ETH_USD, errors: [] }
}

/** Cached market data; a failed refresh keeps the previous numbers (stale: true) and retries after 15 s. */
export async function getMarket(): Promise<MarketData> {
  if (!LIVE_MARKET) return MARKET_OFF
  if (MARKET_FIXTURE) return fixtureMarket()
  const now = Date.now()
  if (cache && now - cache.at < TTL_MS) return cache.data
  if (!inflight) {
    inflight = fetchMarket(now)
      .then((d) => {
        const prev = cache?.data
        if (d.ok) {
          // a ticker that failed this round keeps its last good quote rather than dropping back to demo numbers
          const quotes = { ...d.quotes }
          let carried = 0
          for (const [k, v] of Object.entries(prev?.quotes ?? {})) if (!quotes[k]) { quotes[k] = v; carried++ }
          const partial = d.errors.length > 0
          cache = { at: partial ? now - TTL_MS + PARTIAL_RETRY_MS : now, data: { ...d, quotes, ethUsd: d.ethUsd ?? prev?.ethUsd ?? null, stale: carried > 0 || partial } }
        } else {
          cache = { at: now - TTL_MS + RETRY_MS, data: prev ? { ...prev, stale: true, errors: d.errors } : d }
        }
        return cache.data
      })
      .catch((e: unknown) => {
        const d: MarketData = cache ? { ...cache.data, stale: true, errors: [msg(e)] } : { ...MARKET_OFF, ok: false, errors: [msg(e)] }
        cache = { at: now - TTL_MS + RETRY_MS, data: d }
        return d
      })
      .finally(() => { inflight = null })
  }
  return inflight
}

/** Cache state without triggering a fetch (for /api/health). */
export function peekMarket(): { on: boolean; source: MarketSource; updatedAt: number | null; stale: boolean; quotes: number; errors: string[] } {
  const d = cache?.data
  return { on: LIVE_MARKET, source: d?.source ?? 'off', updatedAt: d?.updatedAt ?? null, stale: d?.stale ?? false, quotes: d ? Object.keys(d.quotes).length : 0, errors: d?.errors ?? [] }
}
