/** Pure helpers for the YT price / TVL time series. Unit-tested. */
import { CHART_DAYS, CHART_POINTS } from '@/contracts/constants'

export type Sample = { t: number; yt: number; tvl: number } // unix seconds, YT price in stock, TVL in USD

export type Resampled = {
  points: number[] // CHART_POINTS values, oldest → newest
  days: number
  changePct: number | null // last / first − 1
  change24hPct: number | null
  tvlChange7dPct: number | null
}

const pct = (now: number, then: number | undefined): number | null => (then && then > 0 ? (now / then - 1) * 100 : null)

/** Value of the latest sample at or before `ts` (carry-forward). */
export function valueAt(samples: readonly Sample[], ts: number, pick: (s: Sample) => number): number | undefined {
  let v: number | undefined
  for (const s of samples) {
    if (s.t > ts) break
    v = pick(s)
  }
  return v
}

/** Resample sorted samples into CHART_POINTS evenly spaced points over the last `days` days. */
export function resample(samplesIn: readonly Sample[], now: number, days = CHART_DAYS): Resampled {
  const samples = [...samplesIn].sort((a, b) => a.t - b.t)
  if (samples.length === 0) return { points: [], days, changePct: null, change24hPct: null, tvlChange7dPct: null }
  const from = now - days * 86_400
  const step = (now - from) / (CHART_POINTS - 1)
  const first = samples.find((s) => s.t >= from) ?? samples[samples.length - 1]
  const points: number[] = []
  for (let i = 0; i < CHART_POINTS; i++) {
    const ts = from + i * step
    points.push(valueAt(samples, ts, (s) => s.yt) ?? first.yt)
  }
  const last = samples[samples.length - 1]
  points[CHART_POINTS - 1] = last.yt
  return {
    points,
    days,
    changePct: pct(last.yt, points[0]),
    change24hPct: pct(last.yt, valueAt(samples, now - 86_400, (s) => s.yt)),
    tvlChange7dPct: pct(last.tvl, valueAt(samples, now - 7 * 86_400, (s) => s.tvl)),
  }
}
