import { describe, expect, it } from 'vitest'
import { buildLedger, checkpointRow, pendingRow, type Checkpoint, type PendingTuple } from './ledger'
import { GUARDIAN_TIMELOCK_SECONDS } from '@/contracts/constants'

const WAD = 10n ** 18n
const cp = (ts: number, kind: number, ratio: number, idx: number): Checkpoint => [BigInt(ts), kind, BigInt(Math.round(ratio * 1e18)), BigInt(Math.round(idx * 1e18))]

describe('ledger builder', () => {
  it('maps checkpoint kinds and wad values', () => {
    const r = checkpointRow(cp(1_700_000_000, 0, 1.0065, 1.0065))
    expect(r).toMatchObject({ ts: 1_700_000_000, event: 'Dividend', held: false })
    expect(r.ratio).toBeCloseTo(1.0065, 9)
    expect(r.indexAfter).toBeCloseTo(1.0065, 9)
    expect(checkpointRow(cp(1, 1, 2, 1)).event).toBe('Split')
    expect(checkpointRow(cp(1, 2, 1.03, 1)).event).toBe('Special dividend')
    expect(checkpointRow(cp(1, 9, 1, 1)).event).toBe('Unclassified')
  })
  it('orders newest first and puts the pending row on top', () => {
    const now = 1_700_100_000
    const pending: PendingTuple = [true, BigInt(now - 3600), WAD, 1_038_100_000_000_000_000n]
    const led = buildLedger([cp(1_700_000_000, 0, 1.0065, 1.0065), cp(1_700_050_000, 0, 1.0065, 1.013)], pending, { probing: false, now })
    expect(led.rows.map((r) => r.ts)).toEqual([now - 3600, 1_700_050_000, 1_700_000_000])
    expect(led.pending?.event).toBe('Special dividend')
    expect(led.pending?.ratio).toBeCloseTo(1.0381, 6)
    expect(led.pending?.timelockRemaining).toBe(GUARDIAN_TIMELOCK_SECONDS - 3600)
    expect(led.events).toBe(2)
  })
  it('stops at the first failed read when probing without checkpointCount()', () => {
    const led = buildLedger([cp(1, 0, 1.01, 1.01), undefined, cp(3, 0, 1.01, 1.02)], undefined, { probing: true, now: 10 })
    expect(led.rows).toHaveLength(1)
  })
  it('skips failed reads when the count is known', () => {
    const led = buildLedger([cp(1, 0, 1.01, 1.01), undefined, cp(3, 0, 1.01, 1.02)], undefined, { probing: false, now: 10 })
    expect(led.rows).toHaveLength(2)
  })
  it('no pending row when nothing is queued', () => {
    expect(pendingRow([false, 0n, 0n, 0n], 0)).toBeNull()
    expect(pendingRow(undefined, 0)).toBeNull()
  })
})
