import { describe, expect, it } from 'vitest'
import { countryFrom, geoHeader, isBlockedCountry, parseCountryList } from './geo'

describe('geo', () => {
  it('parses a comma list, trims, uppercases and drops junk', () => {
    expect([...parseCountryList(' us, ca ,GB,,xyz,1')]).toEqual(['US', 'CA', 'GB'])
    expect(parseCountryList(undefined).size).toBe(0)
  })
  it('trusts exactly one header: GEO_HEADER, else the platform default', () => {
    expect(geoHeader({})).toBe('x-country-code')
    expect(geoHeader({ VERCEL: '1' })).toBe('x-vercel-ip-country')
    expect(geoHeader({ GEO_HEADER: ' CF-IPCountry ' })).toBe('cf-ipcountry')
    expect(geoHeader({ GEO_HEADER: 'cf-ipcountry', VERCEL: '1' })).toBe('cf-ipcountry')
  })
  it('reads only the trusted header and ignores unknown markers', () => {
    expect(countryFrom((h) => (h === 'cf-ipcountry' ? 'de' : null), 'cf-ipcountry')).toBe('DE')
    // a client-supplied platform header is not consulted when the proxy's header is the trusted one
    expect(countryFrom((h) => (h === 'x-vercel-ip-country' ? 'DE' : h === 'x-country-code' ? 'US' : null), 'x-country-code')).toBe('US')
    expect(countryFrom((h) => (h === 'x-vercel-ip-country' ? 'DE' : null), 'x-country-code')).toBeNull()
    expect(countryFrom((h) => (h === 'cf-ipcountry' ? 'XX' : null), 'cf-ipcountry')).toBeNull()
    expect(countryFrom(() => null, 'x-country-code')).toBeNull()
  })
  it('blocks only listed countries and never blocks an unknown origin', () => {
    const b = parseCountryList('US,CA')
    expect(isBlockedCountry('US', b)).toBe(true)
    expect(isBlockedCountry('DE', b)).toBe(false)
    expect(isBlockedCountry(null, b)).toBe(false)
  })
})
