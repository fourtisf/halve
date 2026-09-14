import { describe, expect, it } from 'vitest'
import { cleanAmount } from './amount'

describe('cleanAmount', () => {
  it('normalises decimal input', () => {
    expect(cleanAmount('1')).toEqual({ str: '1', num: 1 })
    expect(cleanAmount(' 2.5 ')).toEqual({ str: '2.5', num: 2.5 })
    expect(cleanAmount('.5')).toEqual({ str: '0.5', num: 0.5 })
    expect(cleanAmount('1.')).toEqual({ str: '1', num: 1 })
  })
  it('rejects zero, negatives and junk', () => {
    expect(cleanAmount('0')).toBeNull()
    expect(cleanAmount('-1')).toBeNull()
    expect(cleanAmount('abc')).toBeNull()
    expect(cleanAmount('')).toBeNull()
    expect(cleanAmount('1e3')).toBeNull()
  })
})
