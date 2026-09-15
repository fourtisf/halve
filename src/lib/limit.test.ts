import { describe, expect, it } from 'vitest'
import { decodeFunctionData } from 'viem'
import {
  ADDRESS_THIS, Q96, amountsForLiquidity, encodeClose, expectedFill, fillProgress, getSqrtRatioAtTick, nonfungiblePositionManagerAbi,
  orderRange, orderStatus, priceToTick, spacingForFee, stockPerTokenAt, tickToPrice, type PoolSide,
} from './limit'


describe('tick maths', () => {
  it('getSqrtRatioAtTick matches √(1.0001^tick)·2^96 across the range', () => {
    expect(getSqrtRatioAtTick(0)).toBe(Q96)
    for (const tick of [-887272, -400000, -100000, -12345, -60, -1, 1, 60, 6931, 100000, 400000, 887272]) {
      const got = Number(getSqrtRatioAtTick(tick)) / 2 ** 96
      const expected = Math.sqrt(Math.pow(1.0001, tick))
      expect(Math.abs(got / expected - 1)).toBeLessThan(1e-9)
    }
    expect(getSqrtRatioAtTick(-887272)).toBe(4295128739n) // MIN_SQRT_RATIO
    expect(getSqrtRatioAtTick(887272)).toBe(1461446703485210103287273052203988822378723970342n) // MAX_SQRT_RATIO
    expect(() => getSqrtRatioAtTick(887273)).toThrow()
  })

  it('price ↔ tick round-trips and honours decimals', () => {
    expect(tickToPrice(0, 18, 18)).toBe(1)
    expect(priceToTick(1, 18, 18)).toBeCloseTo(0, 9)
    expect(tickToPrice(priceToTick(0.96, 18, 18), 18, 18)).toBeCloseTo(0.96, 12)
    // USDC-style quote: 1 token (18 dec) = 2000 quote (6 dec) → raw price 2000e6 / 1e18
    expect(tickToPrice(priceToTick(2000, 18, 6), 18, 6)).toBeCloseTo(2000, 9)
    expect(priceToTick(2000, 18, 6)).toBeCloseTo(Math.log(2000e-12) / Math.log(1.0001), 6)
  })

  it('knows the factory tick spacings', () => {
    expect([100, 500, 3000, 10000].map(spacingForFee)).toEqual([1, 10, 60, 200])
    expect(spacingForFee(1234)).toBe(60)
  })
})

const pt0: PoolSide = { tokenIsToken0: true, tokenDecimals: 18, stockDecimals: 18, spacing: 60 }
const pt1: PoolSide = { ...pt0, tokenIsToken0: false }
const tickAt = (stockPerToken: number, p: PoolSide) => Math.round(priceToTick(p.tokenIsToken0 ? stockPerToken : 1 / stockPerToken, 18, 18))

describe('orderRange', () => {
  it('buy below the market: a single tick of stock just under the limit, filling at the limit or better', () => {
    const current = tickAt(0.96, pt0) // PT is token0, price = stock per PT
    const r = orderRange('buy', 0.95, current, pt0)
    expect(r.ok).toBe(true)
    expect(r.depositIsToken0).toBe(false) // stock is token1
    expect(r.tickUpper - r.tickLower).toBe(60)
    expect(Math.abs(r.tickUpper % 60)).toBe(0)
    expect(r.tickUpper).toBeLessThan(current)
    expect(r.priceHigh).toBeLessThanOrEqual(0.95) // never pays more than the limit
    expect(r.priceLow).toBeCloseTo(r.priceHigh / Math.pow(1.0001, 60), 9)
    expect(r.current).toBeCloseTo(0.96, 3)
    expect(orderStatus(r.tickLower, r.tickUpper, r.depositIsToken0, current)).toBe('open')
    expect(orderStatus(r.tickLower, r.tickUpper, r.depositIsToken0, r.tickLower + 1)).toBe('partial')
    expect(orderStatus(r.tickLower, r.tickUpper, r.depositIsToken0, r.tickLower - 1)).toBe('filled')
  })

  it('sell above the market: a single tick of the token just over the limit', () => {
    const current = tickAt(0.96, pt0)
    const r = orderRange('sell', 0.97, current, pt0)
    expect(r.ok).toBe(true)
    expect(r.depositIsToken0).toBe(true)
    expect(r.tickLower).toBeGreaterThan(current)
    expect(Math.abs(r.tickLower % 60)).toBe(0)
    expect(r.priceLow).toBeGreaterThanOrEqual(0.97) // never sells below the limit
    expect(orderStatus(r.tickLower, r.tickUpper, true, current)).toBe('open')
    expect(orderStatus(r.tickLower, r.tickUpper, true, r.tickUpper)).toBe('filled')
    expect(orderStatus(r.tickLower, r.tickUpper, true, r.tickUpper - 1)).toBe('partial')
  })

  it('flips sides when the token is token1 of the pool', () => {
    const current = tickAt(0.96, pt1) // price in pool terms is PT per stock, so a cheaper PT is a higher tick
    const buy = orderRange('buy', 0.95, current, pt1)
    expect(buy.ok).toBe(true)
    expect(buy.depositIsToken0).toBe(true) // stock is token0 → range above the current tick
    expect(buy.tickLower).toBeGreaterThan(current)
    expect(buy.priceHigh).toBeLessThanOrEqual(0.95 + 1e-12)
    expect(orderStatus(buy.tickLower, buy.tickUpper, true, buy.tickUpper)).toBe('filled')
    const sell = orderRange('sell', 0.97, current, pt1)
    expect(sell.ok).toBe(true)
    expect(sell.depositIsToken0).toBe(false)
    expect(sell.tickUpper).toBeLessThanOrEqual(current)
    expect(sell.priceLow).toBeGreaterThanOrEqual(0.97 - 1e-12)
    // both edges of the range map back to stock per token consistently
    expect(stockPerTokenAt(sell.tickLower, pt1)).toBeCloseTo(sell.priceHigh, 12)
    expect(stockPerTokenAt(sell.tickUpper, pt1)).toBeCloseTo(sell.priceLow, 12)
  })

  it('refuses a limit on the wrong side of the market or too close to it, and bad prices', () => {
    const current = tickAt(0.96, pt0)
    expect(orderRange('buy', 0.97, current, pt0)).toMatchObject({ ok: false, reason: expect.stringMatching(/below the current price/) })
    expect(orderRange('sell', 0.95, current, pt0)).toMatchObject({ ok: false, reason: expect.stringMatching(/above the current price/) })
    expect(orderRange('buy', 0.9599, current, pt0).ok).toBe(true) // just under: rounds down to the bucket below the current tick
    // a hair above the current price still works: the range starts at the next bucket edge, so the fill is better than asked
    const hair = orderRange('sell', stockPerTokenAt(-419.9, pt0), -420, pt0)
    expect(hair.ok).toBe(true)
    expect(hair.tickLower).toBe(-360)
    expect(orderRange('sell', stockPerTokenAt(-420, pt0), -420, pt0).ok).toBe(false) // exactly the current price
    expect(orderRange('buy', 0, current, pt0)).toMatchObject({ ok: false, reason: 'Enter a price' })
    expect(orderRange('buy', NaN, current, pt0).ok).toBe(false)
    expect(orderRange('buy', 1e-40, current, pt0)).toMatchObject({ ok: false, reason: 'Price out of range' })
  })
})

describe('position amounts', () => {
  const sqrtA = getSqrtRatioAtTick(-600)
  const sqrtB = getSqrtRatioAtTick(-540)
  const L = 10n ** 21n

  it('holds only token0 below, only token1 above, both inside', () => {
    const below = amountsForLiquidity(getSqrtRatioAtTick(-700), sqrtA, sqrtB, L)
    expect(below.amount1).toBe(0n)
    expect(below.amount0).toBeGreaterThan(0n)
    const above = amountsForLiquidity(getSqrtRatioAtTick(-500), sqrtA, sqrtB, L)
    expect(above.amount0).toBe(0n)
    // amount1 = L × (√B − √A) / 2^96
    expect(above.amount1).toBe((L * (sqrtB - sqrtA)) / Q96)
    const inside = amountsForLiquidity(getSqrtRatioAtTick(-570), sqrtA, sqrtB, L)
    expect(inside.amount0).toBeGreaterThan(0n)
    expect(inside.amount1).toBeGreaterThan(0n)
    expect(inside.amount1).toBeLessThan(above.amount1)
    expect(inside.amount0).toBeLessThan(below.amount0)
    expect(amountsForLiquidity(getSqrtRatioAtTick(-700), sqrtB, sqrtA, L)).toEqual(below) // order of the edges does not matter
  })

  it('a full fill converts token1 into token0 at the range prices (≈ 1/√(pa·pb))', () => {
    const p0 = amountsForLiquidity(getSqrtRatioAtTick(-500), sqrtA, sqrtB, L).amount1 // stock deposited
    const p1 = amountsForLiquidity(getSqrtRatioAtTick(-700), sqrtA, sqrtB, L).amount0 // PT after the fill
    const pa = tickToPrice(-600, 18, 18)
    const pb = tickToPrice(-540, 18, 18)
    expect(Number(p1) / Number(p0)).toBeCloseTo(1 / Math.sqrt(pa * pb), 6)
    expect(expectedFill('buy', 10, pa, pb)).toBeCloseTo(10 / Math.sqrt(pa * pb), 12)
    expect(expectedFill('sell', 10, pa, pb)).toBeCloseTo(10 * Math.sqrt(pa * pb), 12)
    expect(expectedFill('buy', 10, 0, 0)).toBe(0)
  })

  it('fill progress reads what the position holds', () => {
    expect(fillProgress('buy', true, 0, 10)).toBe(0) // all stock, nothing bought yet
    expect(fillProgress('buy', true, 10.4, 0)).toBe(1)
    expect(fillProgress('buy', true, 5, 5)).toBe(0.5)
    expect(fillProgress('sell', false, 3, 1)).toBe(0.75) // token is token1: 3 stock out of 3 + 1 token
    expect(fillProgress('sell', true, 0, 0)).toBe(0)
  })
})

describe('encodeClose', () => {
  it('decreases, collects to the owner and burns, skipping decrease when there is no liquidity', () => {
    const owner = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
    const calls = encodeClose(7n, 123n, owner, 999n)
    expect(calls).toHaveLength(3)
    expect(decodeFunctionData({ abi: nonfungiblePositionManagerAbi, data: calls[0] })).toMatchObject({ functionName: 'decreaseLiquidity', args: [{ tokenId: 7n, liquidity: 123n, deadline: 999n }] })
    expect(decodeFunctionData({ abi: nonfungiblePositionManagerAbi, data: calls[1] })).toMatchObject({ functionName: 'collect', args: [{ tokenId: 7n, recipient: owner }] })
    expect(decodeFunctionData({ abi: nonfungiblePositionManagerAbi, data: calls[2] })).toMatchObject({ functionName: 'burn', args: [7n] })
    expect(encodeClose(7n, 0n, owner, 999n)).toHaveLength(2)
    expect(ADDRESS_THIS).toBe('0x0000000000000000000000000000000000000002')
  })
})
