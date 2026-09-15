import { describe, expect, it } from 'vitest'
import type { Address } from 'viem'
import type { Series } from '@/contracts/types'
import { isMatured, isSettled, parseStats, statsContracts, STATS_PER_SERIES, type ReadResult } from './stats'

const A = (n: number): Address => `0x${n.toString(16).padStart(40, '0')}` as Address
const series: Series = {
  id: 'T-MAR27', ticker: 'T', name: 'Test', issuer: 'Robinhood',
  underlying: A(1), vault: A(2), pt: A(3), yt: A(4), accountant: A(5), poolPT: A(6), poolYT: A(7), priceFeed: A(8),
  maturity: 1_806_451_200, cap: 100n * 10n ** 18n, decimals: 18,
}
const Q96 = 2n ** 96n
const sqrtFor = (p: number) => BigInt(Math.round(Math.sqrt(p) * 1e9)) * Q96 / 1_000_000_000n
const okr = (result: unknown): ReadResult => ({ status: 'success', result })
const fail: ReadResult = { status: 'failure', error: new Error('revert') }
const WAD = 10n ** 18n

function results(over: Partial<Record<number, ReadResult>> = {}): ReadResult[] {
  const base: ReadResult[] = [
    okr(54n * WAD), // totalDeposits
    okr(100n * WAD), // cap
    okr(WAD), // d0
    okr(0), // state
    okr(1_026_255_000_000_000_000n), // dividendIndex
    okr(WAD), // splitFactor
    okr(true), // isSynced
    okr(4n), // checkpointCount
    okr([sqrtFor(0.9587), 0, 0, 0, 0, 0, true]), // poolPT slot0 (PT is token0 → 0.9587 stock per PT)
    okr(A(3)), // poolPT token0 = pt
    okr([sqrtFor(1 / 0.0413), 0, 0, 0, 0, 0, true]), // poolYT slot0 (stock is token0 → invert)
    okr(A(1)), // poolYT token0 = underlying
    okr(18), okr(18), okr(18), // decimals
    okr([1n, 5_710_000_000n, 0n, 0n, 1n]), // latestRoundData: $57.10 with 8 decimals
    okr(8), // feed decimals
    okr(WAD), // stock uiMultiplier
  ]
  return base.map((r, i) => over[i] ?? r)
}

describe('statsContracts', () => {
  it('lays out STATS_PER_SERIES calls per series', () => {
    expect(statsContracts(series)).toHaveLength(STATS_PER_SERIES)
  })
})

describe('parseStats', () => {
  const now = 1_789_393_040 // ~0.54y before maturity
  it('derives prices, APY, capacity, TVL and accrued from a multicall result', () => {
    const st = parseStats(series, results(), 0, now)
    expect(st.ready).toBe(true)
    expect(st.ptPrice).toBeCloseTo(0.9587, 4)
    expect(st.ytPrice).toBeCloseTo(0.0413, 4)
    expect(st.fixedApy).toBeCloseTo(Math.pow(1 / 1.026255 / 0.9587, 1 / st.yearsToMaturity) - 1, 6) // relative to the PT's principal d0/D
    expect(st.leverage).toBeCloseTo(24.2, 1)
    expect(st.capacityUsed).toBeCloseTo(0.54, 4)
    expect(st.usdPrice).toBeCloseTo(57.1, 6)
    expect(st.tvlUsd).toBeCloseTo(54 * 57.1, 3)
    expect(st.accrued).toBeCloseTo(0.026255, 6)
    expect(st.events).toBe(4)
    expect(st.isSynced).toBe(true)
    expect(st.isMock).toBe(false)
  })
  it('exposes the ERC-8056 display multiplier without touching pool prices (raw units)', () => {
    const st = parseStats(series, results({ 17: okr(1_050_000_000_000_000_000n) }), 0, now)
    expect(st.uiMultiplier).toBeCloseTo(1.05, 9)
    expect(st.ptPrice).toBeCloseTo(0.9587, 4)
  })
  it('respects the base offset for batched series', () => {
    const data = [...results().map(() => fail), ...results()]
    expect(parseStats(series, data, STATS_PER_SERIES, now).ready).toBe(true)
    expect(parseStats(series, data, 0, now).ready).toBe(false)
  })
  it('is not ready while a pool read fails, but still returns safe defaults', () => {
    const st = parseStats(series, results({ 8: fail }), 0, now)
    expect(st.ready).toBe(false)
    expect(st.ptPrice).toBe(0)
    expect(st.fixedApy).toBe(0)
    expect(Number.isFinite(st.tvlUsd)).toBe(true)
  })
  it('does not multiply the Chainlink price by the UI multiplier', () => {
    const st = parseStats(series, results(), 0, now)
    expect(st.usdPrice).toBeCloseTo(57.1, 6)
  })
  it('maturity helpers', () => {
    const st = parseStats(series, results(), 0, now)
    expect(isMatured(series, st, now)).toBe(false)
    expect(isMatured(series, st, series.maturity + 1)).toBe(true)
    expect(isMatured(series, { ...st, state: 1 }, now)).toBe(true)
    expect(isSettled(st)).toBe(false)
    expect(isSettled({ ...st, state: 2 })).toBe(true)
  })
})
