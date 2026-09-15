/**
 * Live market data for the preview: real share prices and trailing dividend yields of the stock tokens'
 * underlyings, shown while the on-chain pools do not exist yet, and used as the USD fallback for a live
 * series without a Chainlink feed. Pure parsing and maths only; fetching and caching live in market-server.ts.
 */
import type { Series } from '@/contracts/types'
import type { SeriesStats } from './types'
import { fixedApy, leverage, yearsToMaturity } from './math'

export type Quote = {
  symbol: string
  price: number
  prevClose: number | null
  change24hPct: number | null
  change7dPct: number | null
  /** Daily closes over the last 30 days, oldest → newest; the last point is the live price. */
  closes30d: number[]
  /** Dividends per share paid in the trailing 12 months (0 when the source had none). */
  dividendsTtm: number
  /** dividendsTtm / price; null when the source carries no dividend data at all. */
  trailingYield: number | null
  currency: string
  /** Unix seconds of the price. */
  at: number
}

export type MarketSource = 'yahoo' | 'stooq' | 'fixture' | 'off'

export type MarketData = {
  ok: boolean
  source: MarketSource
  updatedAt: number | null
  /** True when the last refresh failed and these are the previous numbers. */
  stale: boolean
  quotes: Record<string, Quote>
  ethUsd: number | null
  errors: string[]
}

export const MARKET_OFF: MarketData = { ok: true, source: 'off', updatedAt: null, stale: false, quotes: {}, ethUsd: null, errors: [] }

const DAY = 86_400
export const HISTORY_DAYS = 30

/** Yahoo Finance v8 chart: a year of daily closes plus dividend events, no API key. */
export const yahooChartUrl = (symbol: string): string =>
  `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1y&interval=1d&events=div`

/** Stooq daily CSV (Date,Open,High,Low,Close,Volume) for the last ~45 days. Prices only, no dividends. */
export function stooqCsvUrl(symbol: string, now = Date.now() / 1000): string {
  const ymd = (t: number) => new Date(t * 1000).toISOString().slice(0, 10).replace(/-/g, '')
  return `https://stooq.com/q/d/l/?s=${encodeURIComponent(symbol.toLowerCase())}.us&i=d&d1=${ymd(now - 45 * DAY)}&d2=${ymd(now)}`
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const pct = (a: number, b: number | null | undefined): number | null => (b != null && b > 0 ? (a / b - 1) * 100 : null)
const sameDay = (a: number, b: number): boolean => Math.floor(a / DAY) === Math.floor(b / DAY)

type Bar = { t: number; c: number }

/** Previous close, 24h / 7d change and the 30-day window from sorted daily bars plus the live price. */
function fromBars(symbol: string, bars: Bar[], price: number, at: number, prevCloseHint: number | null, dividendsTtm: number | null, currency: string, now: number): Quote {
  const last = bars.length ? bars[bars.length - 1] : undefined
  const prevClose = prevCloseHint ?? (last ? (sameDay(last.t, at) ? (bars.length > 1 ? bars[bars.length - 2].c : null) : last.c) : null)
  let p7: number | null = null
  for (let i = bars.length - 1; i >= 0; i--) if (bars[i].t <= at - 7 * DAY) { p7 = bars[i].c; break }
  const closes30d = bars.filter((b) => b.t >= now - HISTORY_DAYS * DAY).map((b) => b.c)
  if (closes30d.length && last && sameDay(last.t, at)) closes30d[closes30d.length - 1] = price
  else closes30d.push(price)
  return {
    symbol,
    price,
    prevClose,
    change24hPct: pct(price, prevClose),
    change7dPct: pct(price, p7),
    closes30d,
    dividendsTtm: dividendsTtm ?? 0,
    trailingYield: dividendsTtm == null ? null : dividendsTtm / price,
    currency,
    at,
  }
}

type YahooChart = {
  chart?: {
    result?: Array<{
      meta?: Record<string, unknown>
      timestamp?: unknown
      events?: { dividends?: Record<string, { amount?: unknown; date?: unknown }> }
      indicators?: { quote?: Array<{ close?: unknown }> }
    }> | null
    error?: { code?: string; description?: string } | null
  }
}

/** Quote from Yahoo's v8 chart response (range=1y, interval=1d, events=div); null when the shape is unusable. */
export function parseYahooChart(symbol: string, json: unknown, now = Date.now() / 1000): Quote | null {
  const r = (json as YahooChart | null)?.chart?.result?.[0]
  const meta = r?.meta
  if (!r || !meta) return null
  const price = num(meta.regularMarketPrice)
  if (price == null || price <= 0) return null
  const ts = Array.isArray(r.timestamp) ? (r.timestamp as unknown[]) : []
  const closeRaw = r.indicators?.quote?.[0]?.close
  const closes = Array.isArray(closeRaw) ? (closeRaw as unknown[]) : []
  const bars: Bar[] = []
  for (let i = 0; i < ts.length; i++) {
    const t = num(ts[i])
    const c = num(closes[i])
    if (t != null && c != null && c > 0) bars.push({ t, c })
  }
  bars.sort((a, b) => a.t - b.t)
  const at = num(meta.regularMarketTime) ?? (bars.length ? bars[bars.length - 1].t : Math.floor(now))
  let ttm = 0
  for (const d of Object.values(r.events?.dividends ?? {})) {
    const amount = num(d?.amount)
    const date = num(d?.date)
    if (amount != null && date != null && date >= now - 365 * DAY) ttm += amount
  }
  const prevHint = num(meta.previousClose) ?? num(meta.regularMarketPreviousClose)
  return fromBars(symbol, bars, price, at, prevHint, ttm, typeof meta.currency === 'string' ? meta.currency : 'USD', now)
}

/** Quote from Stooq's daily CSV: last close as the price, no dividend data. */
export function parseStooqCsv(symbol: string, csv: string, now = Date.now() / 1000): Quote | null {
  const bars: Bar[] = []
  for (const line of csv.split(/\r?\n/).slice(1)) {
    const cols = line.split(',')
    if (cols.length < 5) continue
    const t = Date.parse(`${cols[0]}T20:00:00Z`) / 1000 // NYSE close, 16:00 New York
    const c = Number(cols[4])
    if (Number.isFinite(t) && Number.isFinite(c) && c > 0) bars.push({ t, c })
  }
  if (!bars.length) return null
  bars.sort((a, b) => a.t - b.t)
  const last = bars[bars.length - 1]
  return fromBars(symbol, bars, last.c, last.t, null, null, 'USD', now)
}

/**
 * Demo series with a live quote: the real share price and trailing yield, PT / YT priced off that yield for the
 * time left (indicative, there is no pool yet), and nothing invented for what does not exist yet (TVL, events).
 */
export function previewStats(series: Series, base: SeriesStats, q: Quote, now = Date.now() / 1000): SeriesStats {
  const years = yearsToMaturity(series.maturity, now)
  const divYield = q.trailingYield ?? base.divYield
  const ytPrice = +Math.max(0, divYield * years).toFixed(4)
  const ptPrice = 1 - ytPrice
  return {
    ...base,
    isPreview: true,
    ready: true,
    ptPrice,
    ytPrice,
    fixedApy: fixedApy(ptPrice, years),
    leverage: leverage(ytPrice),
    divYield,
    yearsToMaturity: years,
    totalDeposits: 0n,
    capacityUsed: 0,
    usdPrice: q.price,
    tvlUsd: 0,
    dividendIndex: 1,
    d0: 1,
    accrued: 0,
    uiMultiplier: 1,
    splitFactor: 1,
    isSynced: true,
    events: 0,
    state: 0,
    tvlChange7d: null,
    ytChange24h: null,
  }
}
