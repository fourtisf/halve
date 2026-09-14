import { describe, expect, it } from 'vitest'
import { accruedFrom, classifyRatio, fixedApy, impliedDividendYield, leverage, poolPrice, wadToNumber, yearsToMaturity } from './math'

const Q96 = 2n ** 96n
/** sqrtPriceX96 for a token1/token0 price `p` with equal decimals. */
const sqrtFor = (p: number) => BigInt(Math.round(Math.sqrt(p) * 1e9)) * Q96 / 1_000_000_000n

describe('poolPrice', () => {
  it('reads token1-per-token0 when the token is token0', () => {
    expect(poolPrice(sqrtFor(0.96), true, 18, 18)).toBeCloseTo(0.96, 6)
  })
  it('inverts when the token is token1', () => {
    expect(poolPrice(sqrtFor(25), false, 18, 18)).toBeCloseTo(0.04, 6)
  })
  it('scales for different decimals (6-dec token vs 18-dec stock)', () => {
    // raw price token1/token0 = 0.96e12 when token0 has 6 decimals and token1 18
    const raw = 0.96 * 1e12
    expect(poolPrice(sqrtFor(raw), true, 6, 18)).toBeCloseTo(0.96, 3)
  })
  it('returns 0 for an uninitialised pool', () => {
    expect(poolPrice(0n, true, 18, 18)).toBe(0)
  })
})

describe('derived series maths (CLAUDE.md formulas)', () => {
  it('fixedApy = (1/ptPrice)^(1/years) − 1', () => {
    expect(fixedApy(1 - 0.0413, 0.53)).toBeCloseTo(0.0828, 3) // JEPI in the prototype
  })
  it('leverage = 1/ytPrice', () => {
    expect(leverage(0.0413)).toBeCloseTo(24.2, 1)
    expect(leverage(0)).toBe(0)
  })
  it('implied dividend yield inverts the mock formula yt = dy × years', () => {
    expect(impliedDividendYield(0.078 * 0.53, 0.53)).toBeCloseTo(0.078, 9)
  })
  it('accrued = dividendIndex / d0 − 1', () => {
    expect(accruedFrom(1_026_255_000_000_000_000n, 10n ** 18n)).toBeCloseTo(0.026255, 9)
    expect(accruedFrom(10n ** 18n, 0n)).toBe(0)
  })
  it('wad conversion', () => {
    expect(wadToNumber(1_500_000_000_000_000_000n)).toBe(1.5)
  })
  it('years to maturity never hits zero', () => {
    expect(yearsToMaturity(1000, 2000)).toBeGreaterThan(0)
    expect(yearsToMaturity(1_806_451_200, 1_789_393_040)).toBeCloseTo(0.54, 2)
  })
})

describe('classifyRatio (oracle bands)', () => {
  it('growth between 0 and 3% is a dividend', () => {
    expect(classifyRatio(1.0065)).toBe('Dividend')
    expect(classifyRatio(1.03)).toBe('Dividend')
  })
  it('a clean small-integer ratio at least 20% from 1 is a split', () => {
    expect(classifyRatio(2)).toBe('Split')
    expect(classifyRatio(0.5)).toBe('Split')
    expect(classifyRatio(1.5)).toBe('Split') // 3-for-2
    expect(classifyRatio(0.25)).toBe('Split') // 1-for-4 reverse split
  })
  it('anything else above 1 is a special dividend, below 1 unclassified', () => {
    expect(classifyRatio(1.0381)).toBe('Special dividend')
    expect(classifyRatio(1.2345678)).toBe('Special dividend')
    expect(classifyRatio(0.9)).toBe('Unclassified')
  })
})
