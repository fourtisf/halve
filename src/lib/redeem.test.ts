import { describe, expect, it } from 'vitest'
import { quoteRedeemPT, quoteRedeemYT } from './redeem'

describe('redeem quotes', () => {
  it('PT redeems one share each, no fee', () => {
    expect(quoteRedeemPT(2.5)).toEqual({ out: 2.5, fee: 0 })
  })
  it('YT redeems accrued dividends less the 5% fee', () => {
    const q = quoteRedeemYT(100, 0.026255)
    expect(q.fee).toBeCloseTo(0.131275, 9)
    expect(q.out).toBeCloseTo(2.494225, 9)
  })
  it('never negative', () => {
    expect(quoteRedeemYT(10, -0.5)).toEqual({ out: 0, fee: 0 })
  })
})
