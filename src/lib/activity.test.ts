import { describe, expect, it } from 'vitest'
import { sortActivity, summarizePnl, type ActivityRow } from './activity'

const rows: ActivityRow[] = [
  { id: 'A', ticker: 'JEPI', action: 'Split', ts: 100, amount: 10, base: 9.99 },
  { id: 'A', ticker: 'JEPI', action: 'Merge', ts: 200, amount: 4, base: 4 },
  { id: 'B', ticker: 'SGOV', action: 'Split', ts: 150, amount: 1, base: 0.999 },
]

describe('activity', () => {
  it('sorts newest first, later insertions first on a tie', () => {
    expect(sortActivity(rows).map((r) => r.ts)).toEqual([200, 150, 100])
    const tie = sortActivity([{ ...rows[0], ts: 5 }, { ...rows[1], ts: 5 }])
    expect(tie.map((r) => r.action)).toEqual(['Merge', 'Split'])
  })
  it('sums deposits and withdrawals per series and values holdings at pool prices', () => {
    const { rows: pnl, total } = summarizePnl(rows, [
      { id: 'A', ticker: 'JEPI', pt: 5.99, yt: 5.99, ptPrice: 0.96, ytPrice: 0.04, usdPrice: 57.1 },
      { id: 'B', ticker: 'SGOV', pt: 0, yt: 0, ptPrice: 0.99, ytPrice: 0.01, usdPrice: 100 },
    ])
    const a = pnl.find((r) => r.id === 'A')!
    expect(a.deposited).toBe(10)
    expect(a.withdrawn).toBe(4)
    expect(a.holdings).toBeCloseTo(5.99, 10) // 5.99 × (0.96 + 0.04)
    expect(a.pnl).toBeCloseTo(-0.01, 10) // the 0.10 % split fee
    expect(a.pnlUsd).toBeCloseTo(-0.571, 6)
    const b = pnl.find((r) => r.id === 'B')!
    expect(b.pnl).toBe(-1) // deposited, holds nothing now → treated as lost until the balance shows up
    expect(total.pnl).toBeCloseTo(-1.01, 10)
  })
  it('includes a series with a balance but no visible activity', () => {
    const { rows: pnl } = summarizePnl([], [{ id: 'C', ticker: 'O', pt: 1, yt: 0, ptPrice: 0.9, ytPrice: 0.1, usdPrice: 50 }])
    expect(pnl).toHaveLength(1)
    expect(pnl[0].pnl).toBeCloseTo(0.9, 10)
  })
})
