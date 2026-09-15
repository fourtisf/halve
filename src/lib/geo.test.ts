import { describe, expect, it } from 'vitest'
import { countryFrom, isBlockedCountry, parseCountryList } from './geo'

describe('geo', () => {
  it('parses a comma list, trims, uppercases and drops junk', () => {
    expect([...parseCountryList(' us, ca ,GB,,xyz,1')]).toEqual(['US', 'CA', 'GB'])
    expect(parseCountryList(undefined).size).toBe(0)
  })
  it('reads the first known geo header and ignores unknown markers', () => {
    expect(countryFrom((h) => (h === 'cf-ipcountry' ? 'de' : null))).toBe('DE')
    expect(countryFrom((h) => (h === 'x-vercel-ip-country' ? 'US' : h === 'cf-ipcountry' ? 'DE' : null))).toBe('US')
    expect(countryFrom((h) => (h === 'cf-ipcountry' ? 'XX' : null))).toBeNull()
    expect(countryFrom(() => null)).toBeNull()
  })
  it('blocks only listed countries and never blocks an unknown origin', () => {
    const b = parseCountryList('US,CA')
    expect(isBlockedCountry('US', b)).toBe(true)
    expect(isBlockedCountry('DE', b)).toBe(false)
    expect(isBlockedCountry(null, b)).toBe(false)
  })
})
