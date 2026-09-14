import { describe, expect, it } from 'vitest'
import { SERIES } from '@/contracts/types'
import { earnApr, mockChart, mockLedger, mockStats } from './mock'

const jepi = SERIES.find((s) => s.ticker === 'JEPI')!
const o = SERIES.find((s) => s.ticker === 'O')!

describe('mock numbers reproduce prototype.html', () => {
  it('JEPI derived values', () => {
    const st = mockStats(jepi)
    expect(st.ytPrice).toBe(0.0413)
    expect(st.fixedApy * 100).toBeCloseTo(8.28, 2)
    expect(st.leverage).toBeCloseTo(24.2, 1)
    expect(st.usdPrice).toBe(57.1)
    expect(st.tvlUsd).toBe(6.2e6)
    expect(st.accrued * 100).toBeCloseTo(2.6, 1)
    expect(st.events).toBe(4)
    expect(st.isSynced).toBe(true)
  })
  it('O is held with a pending special dividend', () => {
    expect(mockStats(o).isSynced).toBe(false)
    const { rows, pending } = mockLedger('O')
    expect(pending?.event).toBe('Special dividend')
    expect(pending?.ratio).toBe(1.0381)
    expect(pending?.timelockRemaining).toBe(30 * 3600)
    expect(rows[0]).toBe(pending) // newest first
    expect(rows).toHaveLength(6)
  })
  it('ledger index compounds monthly', () => {
    const { rows } = mockLedger('JEPI')
    expect(rows).toHaveLength(4)
    expect(rows[rows.length - 1].indexAfter).toBeCloseTo(1.0065, 6)
    expect(rows[0].indexAfter).toBeCloseTo(1.026255, 5)
  })
  it('chart is deterministic per series index', () => {
    expect(mockChart(1)).toHaveLength(31)
    expect(mockChart(1)).toEqual(mockChart(1))
    expect(mockChart(1)).not.toEqual(mockChart(2))
  })
  it('earn APR formula', () => {
    expect(earnApr(0.078)).toBeCloseTo(7.12, 6)
  })
})
