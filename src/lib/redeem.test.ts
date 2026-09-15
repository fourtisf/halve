import { describe, expect, it } from 'vitest'
import { quoteRedeemPT, quoteRedeemYT, ytClaim } from './redeem'

describe('redeem quotes (raw stock units)', () => {
  it('PT redeems its share count: raw × d0 / dm', () => {
    expect(quoteRedeemPT(100, 0).out).toBe(100)
    expect(quoteRedeemPT(100, 0.0201).out).toBeCloseTo(100 / 1.0201, 9)
    expect(quoteRedeemPT(100, 0.0201).fee).toBe(0)
  })
  it('YT redeems the reinvested dividends less the 5% fee, and PT + YT + fee is the raw deposit', () => {
    const pt = quoteRedeemPT(100, 0.0201)
    const yt = quoteRedeemYT(100, 0.0201)
    expect(ytClaim(100, 0.0201)).toBeCloseTo(100 - 100 / 1.0201, 9)
    expect(yt.fee).toBeCloseTo(ytClaim(100, 0.0201) * 0.05, 9)
    expect(pt.out + yt.out + yt.fee).toBeCloseTo(100, 9)
  })
  it('never quotes a negative payout', () => {
    expect(quoteRedeemYT(100, -0.01).out).toBe(0)
    expect(quoteRedeemPT(100, -0.01).out).toBe(100)
  })
})
