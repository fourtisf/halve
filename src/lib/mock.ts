/**
 * Prototype mock numbers (verbatim from prototype.html) and the derivations it applied.
 * Used whenever MOCK=true or a series still has placeholder addresses.
 */
import type { LedgerRow, SeriesStats } from './types'
import type { Series } from '@/contracts/types'

export type MockSeries = {
  t: string
  name: string
  iss: string
  px: number // USD price
  dy: number // declared dividend yield (annual)
  yrs: number // years to maturity used by the prototype
  cap: number // capacity used, percent
  tvl: number // USD split
  ev: number // dividend events this term
}

export const MOCK_SERIES: MockSeries[] = [
  { t: 'SGOV', name: 'iShares 0-3M Treasury', iss: 'Robinhood', px: 100.62, dy: 0.046, yrs: 0.53, cap: 71, tvl: 8.4e6, ev: 6 },
  { t: 'JEPI', name: 'JPM Equity Premium Income', iss: 'Backed', px: 57.1, dy: 0.078, yrs: 0.53, cap: 54, tvl: 6.2e6, ev: 4 },
  { t: 'O', name: 'Realty Income', iss: 'Dinari', px: 58.4, dy: 0.055, yrs: 0.53, cap: 22, tvl: 1.4e6, ev: 5 },
  { t: 'SCHD', name: 'Schwab US Dividend', iss: 'Robinhood', px: 28.9, dy: 0.036, yrs: 0.53, cap: 38, tvl: 1.6e6, ev: 2 },
  { t: 'SPY', name: 'S&P 500 ETF', iss: 'Robinhood', px: 612.1, dy: 0.012, yrs: 0.53, cap: 18, tvl: 0.7e6, ev: 1 },
  { t: 'AAPL', name: 'Apple', iss: 'Robinhood', px: 228.4, dy: 0.005, yrs: 0.53, cap: 9, tvl: 0.3e6, ev: 2 },
]

export const MOCK_BALANCE = 12.4
export const MOCK_START_BLOCK = 4_812_337
export const MOCK_DIVIDENDS_DISTRIBUTED = 412_000
export const MOCK_TVL_CHANGE_7D = 8.1
export const MOCK_YT_CHANGE_24H = 2.4
export const MOCK_CHART_CHANGE = 4.2
/** The prototype's "O" series has a held special dividend with 1d 06h left on the timelock. */
export const MOCK_HELD_TICKER = 'O'
export const MOCK_HELD_RATIO = 1.0381
export const MOCK_HELD_REMAINING = 30 * 3600

export function mockFor(ticker: string): MockSeries {
  return MOCK_SERIES.find((m) => m.t === ticker) ?? { ...MOCK_SERIES[1], t: ticker, name: ticker }
}

export function mockStats(series: Series): SeriesStats {
  const m = mockFor(series.ticker)
  const ytPrice = +(m.dy * m.yrs).toFixed(4)
  const ptPrice = 1 - ytPrice
  const fixedApy = Math.pow(1 / ptPrice, 1 / m.yrs) - 1
  const per = m.dy / 12
  const cap = series.cap
  const totalDeposits = (cap * BigInt(m.cap)) / 100n
  return {
    isMock: true,
    ready: true,
    ptPrice,
    ytPrice,
    fixedApy,
    leverage: 1 / ytPrice,
    divYield: m.dy,
    yearsToMaturity: m.yrs,
    totalDeposits,
    cap,
    capacityUsed: m.cap / 100,
    usdPrice: m.px,
    tvlUsd: m.tvl,
    dividendIndex: Math.pow(1 + per, m.ev),
    d0: 1,
    accrued: (m.dy * m.ev) / 12,
    splitFactor: 1,
    isSynced: m.t !== MOCK_HELD_TICKER,
    events: m.ev,
    state: 0,
    decimals: series.decimals,
    tvlChange7d: MOCK_TVL_CHANGE_7D,
    ytChange24h: MOCK_YT_CHANGE_24H,
  }
}

const MONTH_TS = (monthIndex: number) => Date.UTC(2026, monthIndex, 1) / 1000 // Mar..Sep 2026

export function mockLedger(ticker: string): { rows: LedgerRow[]; pending: LedgerRow | null } {
  const m = mockFor(ticker)
  const per = m.dy / 12
  let idx = 1
  const rows: LedgerRow[] = []
  for (let i = 0; i < m.ev; i++) {
    idx *= 1 + per
    rows.push({ ts: MONTH_TS(2 + Math.min(i, 6)), event: 'Dividend', ratio: 1 + per, indexAfter: idx, held: false })
  }
  let pending: LedgerRow | null = null
  if (m.t === MOCK_HELD_TICKER) {
    pending = { ts: MONTH_TS(8), event: 'Special dividend', ratio: MOCK_HELD_RATIO, indexAfter: null, held: true, timelockRemaining: MOCK_HELD_REMAINING }
    rows.push(pending)
  }
  return { rows: rows.reverse(), pending }
}

/** Prototype chart generator: 31 points, seeded by the series index. */
export function mockChart(seriesIndex: number): number[] {
  let v = 40
  const p: number[] = []
  for (let i = 0; i <= 30; i++) {
    v += Math.sin(i * 0.7 + seriesIndex) * 4 + 1.2
    p.push(v)
  }
  return p
}

/** Prototype "Est. APR" for the Earn tab. */
export const earnApr = (divYield: number): number => 4 + divYield * 40
