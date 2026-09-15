import { describe, expect, it } from 'vitest'
import { SERIES } from '@/contracts/types'
import { YEAR_SECONDS } from './math'
import { HISTORY_DAYS, parseStooqCsv, parseYahooChart, previewStats, stooqCsvUrl, yahooChartUrl } from './market'
import { mockStats } from './mock'

const DAY = 86_400
const NOW = Date.UTC(2026, 8, 15, 14, 0, 0) / 1000 // Tue 2026-09-15 14:00Z, NYSE open
const OPEN = Math.floor(NOW / DAY) * DAY + 13.5 * 3600 // 09:30 New York in September

/** A year of weekday sessions in Yahoo's v8 chart shape; today's bar is the intraday close. */
function yahooFixture(opts: { previousClose?: number | null; price?: number } = {}) {
  const price = opts.price ?? 612.1
  const timestamp: number[] = []
  const close: (number | null)[] = []
  for (let k = 365; k >= 0; k--) {
    const t = OPEN - k * DAY
    const dow = new Date(t * 1000).getUTCDay()
    if (dow === 0 || dow === 6) continue
    timestamp.push(t)
    close.push(k === 3 ? null : 600 - k * 0.2) // one missing print, older sessions lower
  }
  close[close.length - 1] = 611.4
  const div = (daysAgo: number) => ({ amount: 1.7, date: NOW - daysAgo * DAY })
  const meta: Record<string, unknown> = { symbol: 'SPY', currency: 'USD', regularMarketPrice: price, regularMarketTime: NOW, chartPreviousClose: 540 }
  if (opts.previousClose !== null) meta.previousClose = opts.previousClose ?? 608.2
  return {
    chart: {
      result: [{
        meta,
        timestamp,
        events: { dividends: { a: div(30), b: div(120), c: div(210), d: div(300), e: div(400) } },
        indicators: { quote: [{ close }] },
      }],
      error: null,
    },
  }
}

describe('parseYahooChart', () => {
  it('reads price, previous close, changes, the 30-day window and trailing dividends', () => {
    const q = parseYahooChart('SPY', yahooFixture(), NOW)!
    expect(q.symbol).toBe('SPY')
    expect(q.price).toBe(612.1)
    expect(q.prevClose).toBe(608.2) // meta.previousClose wins
    expect(q.change24hPct).toBeCloseTo((612.1 / 608.2 - 1) * 100, 6)
    expect(q.change7dPct).toBeCloseTo((612.1 / (600 - 7 * 0.2) - 1) * 100, 6) // the bar 7 days back
    expect(q.dividendsTtm).toBeCloseTo(6.8, 9) // 4 payouts inside 365 days, the 400-day one excluded
    expect(q.trailingYield).toBeCloseTo(6.8 / 612.1, 9)
    expect(q.closes30d.length).toBeGreaterThanOrEqual(20)
    expect(q.closes30d.length).toBeLessThanOrEqual(HISTORY_DAYS)
    expect(q.closes30d[q.closes30d.length - 1]).toBe(612.1) // today's bar replaced by the live price
    expect(q.closes30d[0]).toBeCloseTo(600 - 29 * 0.2, 6)
    expect(q.at).toBe(NOW)
    expect(q.currency).toBe('USD')
  })

  it('derives the previous close from the bars when meta has none', () => {
    const q = parseYahooChart('SPY', yahooFixture({ previousClose: null }), NOW)!
    expect(q.prevClose).toBeCloseTo(600 - 0.2, 6) // yesterday's session, today's bar is intraday
  })

  it('rejects an error payload or a missing price', () => {
    expect(parseYahooChart('NOPE', { chart: { result: null, error: { code: 'Not Found' } } }, NOW)).toBeNull()
    expect(parseYahooChart('X', { chart: { result: [{ meta: { symbol: 'X' } }] } }, NOW)).toBeNull()
    expect(parseYahooChart('X', null, NOW)).toBeNull()
    expect(parseYahooChart('X', 'garbage', NOW)).toBeNull()
  })

  it('builds the request URLs', () => {
    expect(yahooChartUrl('ETH-USD')).toBe('https://query1.finance.yahoo.com/v8/finance/chart/ETH-USD?range=1y&interval=1d&events=div')
    expect(stooqCsvUrl('SPY', NOW)).toBe('https://stooq.com/q/d/l/?s=spy.us&i=d&d1=20260801&d2=20260915')
  })
})

describe('parseStooqCsv', () => {
  it('uses the last close as the price and carries no dividend data', () => {
    const csv = 'Date,Open,High,Low,Close,Volume\n2026-09-11,608,612,606,610.5,1000\n2026-09-14,611,613,609,611.9,1200\n\n'
    const q = parseStooqCsv('SPY', csv, NOW)!
    expect(q.price).toBe(611.9)
    expect(q.prevClose).toBe(610.5)
    expect(q.change24hPct).toBeCloseTo((611.9 / 610.5 - 1) * 100, 6)
    expect(q.closes30d).toEqual([610.5, 611.9])
    expect(q.trailingYield).toBeNull()
    expect(q.dividendsTtm).toBe(0)
    expect(parseStooqCsv('SPY', 'Date,Open,High,Low,Close,Volume\n', NOW)).toBeNull()
    expect(parseStooqCsv('SPY', 'No data', NOW)).toBeNull()
  })
})

describe('previewStats', () => {
  const series = { ...SERIES[1], ticker: 'SCHD', maturity: NOW + 0.5 * YEAR_SECONDS }
  const quote = parseYahooChart('SCHD', yahooFixture({ price: 100 }), NOW)!

  it('prices PT and YT off the real trailing yield and the time left, and invents nothing else', () => {
    const q = { ...quote, trailingYield: 0.038 }
    const s = previewStats(series, mockStats(series), q, NOW)
    expect(s.isPreview).toBe(true)
    expect(s.isMock).toBe(true) // the demo wallet still works
    expect(s.usdPrice).toBe(100)
    expect(s.divYield).toBe(0.038)
    expect(s.ytPrice).toBe(0.019)
    expect(s.ptPrice).toBe(0.981)
    expect(s.fixedApy).toBeCloseTo(Math.pow(1 / 0.981, 2) - 1, 6)
    expect(s.leverage).toBeCloseTo(1 / 0.019, 6)
    expect(s.tvlUsd).toBe(0)
    expect(s.totalDeposits).toBe(0n)
    expect(s.events).toBe(0)
    expect(s.accrued).toBe(0)
    expect(s.tvlChange7d).toBeNull()
  })

  it('keeps the demo yield when the source has no dividend data, and prices a non-payer at par', () => {
    const base = mockStats(series)
    expect(previewStats(series, base, { ...quote, trailingYield: null }, NOW).divYield).toBe(base.divYield)
    const none = previewStats(series, base, { ...quote, trailingYield: 0 }, NOW)
    expect(none.ytPrice).toBe(0)
    expect(none.ptPrice).toBe(1)
    expect(none.fixedApy).toBe(0)
  })
})
