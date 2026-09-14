import { describe, expect, it } from 'vitest'
import { dh, f, fmtInt, monthYear, pct1, shortAddr, usd, usd2 } from './format'

describe('format helpers (prototype-identical)', () => {
  it('f pads to exactly d decimals with grouping', () => {
    expect(f(0.999)).toBe('0.9990')
    expect(f(1234.5, 2)).toBe('1,234.50')
    expect(f(NaN, 2)).toBe('0.00')
  })
  it('usd abbreviates like the prototype', () => {
    expect(usd(18.6e6)).toBe('$18.6M')
    expect(usd(412_000)).toBe('$412K')
    expect(usd(840_000)).toBe('$840K')
  })
  it('usd2 / pct1', () => {
    expect(usd2(54.694)).toBe('$54.69')
    expect(pct1(0.0828)).toBe('8.3%')
  })
  it('shortAddr matches the prototype address style', () => {
    expect(shortAddr('0x7A3f00000000000000000000000000000000C32F')).toBe('0x7A3f…C32F')
  })
  it('monthYear / dh / fmtInt', () => {
    expect(monthYear(1_806_451_200)).toBe('Mar 2027')
    expect(dh(30 * 3600)).toBe('1d 06h')
    expect(dh(0)).toBe('0d 00h')
    expect(fmtInt(4_812_337)).toBe('4,812,337')
    expect(fmtInt(4_812_337n)).toBe('4,812,337')
  })
})
