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
  // Demo numbers only (MOCK mode). Every ticker here exists as a Robinhood stock token on chain 4663.
  { t: 'SGOV', name: 'iShares 0-3M Treasury', iss: 'Robinhood', px: 100.62, dy: 0.046, yrs: 0.53, cap: 71, tvl: 8.4e6, ev: 6 },
  { t: 'SCHD', name: 'Schwab US Dividend', iss: 'Robinhood', px: 28.9, dy: 0.078, yrs: 0.53, cap: 54, tvl: 6.2e6, ev: 4 },
  { t: 'SPY', name: 'S&P 500 ETF', iss: 'Robinhood', px: 612.1, dy: 0.012, yrs: 0.53, cap: 18, tvl: 0.7e6, ev: 1 },
  { t: 'AAPL', name: 'Apple', iss: 'Robinhood', px: 228.4, dy: 0.005, yrs: 0.53, cap: 9, tvl: 0.3e6, ev: 2 },
  // Yields follow the real payout policies: NVDA pays ~0.02 %, MSFT / GOOGL / META small quarterly
  // dividends, AMZN and TSLA none (0 % → PT at par, YT ≈ 0).
  { t: 'NVDA', name: 'NVIDIA', iss: 'Robinhood', px: 185.2, dy: 0.0002, yrs: 0.53, cap: 33, tvl: 2.1e6, ev: 2 },
  { t: 'MSFT', name: 'Microsoft', iss: 'Robinhood', px: 512.3, dy: 0.007, yrs: 0.53, cap: 27, tvl: 1.9e6, ev: 2 },
  { t: 'AMZN', name: 'Amazon', iss: 'Robinhood', px: 231.4, dy: 0, yrs: 0.53, cap: 8, tvl: 0.5e6, ev: 0 },
  { t: 'GOOGL', name: 'Alphabet', iss: 'Robinhood', px: 245.6, dy: 0.0035, yrs: 0.53, cap: 15, tvl: 0.9e6, ev: 2 },
  { t: 'META', name: 'Meta Platforms', iss: 'Robinhood', px: 742.1, dy: 0.0028, yrs: 0.53, cap: 12, tvl: 0.8e6, ev: 2 },
  { t: 'TSLA', name: 'Tesla', iss: 'Robinhood', px: 412.8, dy: 0, yrs: 0.53, cap: 11, tvl: 0.6e6, ev: 0 },
]

export const MOCK_BALANCE = 12.4
/** Demo ETH price for the Buy tab (USD). */
export const MOCK_ETH_USD = 4_000
export const MOCK_START_BLOCK = 4_812_337
export const MOCK_DIVIDENDS_DISTRIBUTED = 412_000
export const MOCK_TVL_CHANGE_7D = 8.1
export const MOCK_YT_CHANGE_24H = 2.4
export const MOCK_CHART_CHANGE = 4.2
/** In the demo, SPY has a held special dividend with 1d 06h left on the timelock. */
export const MOCK_HELD_TICKER = 'SPY'
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
    leverage: ytPrice > 0 ? 1 / ytPrice : 0,
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
    uiMultiplier: Math.pow(1 + per, m.ev),
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
