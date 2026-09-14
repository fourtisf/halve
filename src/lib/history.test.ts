import { describe, expect, it } from 'vitest'
import { resample, valueAt, type Sample } from './history'
import { CHART_POINTS } from '@/contracts/constants'

const day = 86_400
const now = 2_000_000_000
const samples: Sample[] = Array.from({ length: 40 }, (_, i) => ({ t: now - (39 - i) * day, yt: 0.03 + i * 0.001, tvl: 1e6 + i * 1e4 }))

describe('history resampling', () => {
  it('valueAt carries the latest sample forward', () => {
    expect(valueAt(samples, now - 0.5 * day, (s) => s.yt)).toBeCloseTo(0.068, 9) // sample at now − 1d
    expect(valueAt(samples, now - 100 * day, (s) => s.yt)).toBeUndefined()
  })
  it('produces CHART_POINTS points ending at the latest sample', () => {
    const r = resample(samples, now)
    expect(r.points).toHaveLength(CHART_POINTS)
    expect(r.points[CHART_POINTS - 1]).toBeCloseTo(0.069, 9)
    expect(r.points[0]).toBeCloseTo(0.039, 9) // 30 days back
    expect(r.changePct).toBeCloseTo((0.069 / 0.039 - 1) * 100, 6)
    expect(r.change24hPct).toBeCloseTo((0.069 / 0.068 - 1) * 100, 6)
    expect(r.tvlChange7dPct).toBeCloseTo((1.39e6 / 1.32e6 - 1) * 100, 6)
  })
  it('back-fills the start when history is shorter than the window', () => {
    const r = resample(samples.slice(-3), now)
    expect(r.points[0]).toBeCloseTo(0.067, 9)
    expect(r.tvlChange7dPct).toBeNull()
  })
  it('handles an empty series', () => {
    expect(resample([], now).points).toEqual([])
  })
})
