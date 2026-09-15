import { describe, expect, it } from 'vitest'
import type { Address } from 'viem'
import { applySlippage, bestQuote, candidateRoutes, encodePath } from './buy'

const A = '0x0bd7d308f8e1639fab988df18a8011f41eacad73' as Address
const B = '0x117cc2133c37b721f49de2a7a74833232b3b4c0c' as Address
const C = '0x1111111111111111111111111111111111111111' as Address

describe('buy helpers', () => {
  it('encodes a Uniswap v3 path as token | fee(3 bytes) | token …', () => {
    expect(encodePath([A, B], [3000])).toBe(`${A}000bb8${B.slice(2)}`)
    expect(encodePath([A, B, C], [500, 3000])).toBe(`${A}0001f4${B.slice(2)}000bb8${C.slice(2)}`)
    expect(() => encodePath([A, B], [])).toThrow()
  })
  it('applies slippage in basis points', () => {
    expect(applySlippage(10_000n, 100)).toBe(9_900n)
    expect(applySlippage(10_000n)).toBe(9_900n)
  })
  it('builds one route for stock and one per fee tier for ETH', () => {
    expect(candidateRoutes('stock', A, B, C, 3000, { stock: 'SPY', token: 'pSPY' })).toHaveLength(1)
    const eth = candidateRoutes('eth', A, B, C, 3000, { stock: 'SPY', token: 'pSPY' })
    expect(eth.map((r) => r.fees)).toEqual([[500, 3000], [3000, 3000], [10000, 3000]])
    expect(eth[1].label).toBe('ETH → SPY (0.3%) → pSPY')
  })
  it('picks the best quote and ignores failed routes', () => {
    const r = candidateRoutes('eth', A, B, C, 3000, { stock: 'SPY', token: 'pSPY' })
    expect(bestQuote([null, { route: r[1], amountOut: 5n }, { route: r[2], amountOut: 7n }])?.amountOut).toBe(7n)
    expect(bestQuote([null, null])).toBeNull()
  })
})
