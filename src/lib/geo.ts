/** Country-level access control for the transactional routes (/app, /lend). Pure; unit-tested. */

/** Headers set by the edge in front of the app: Vercel, Cloudflare, or a custom GeoIP module (Caddy / nginx). */
export const COUNTRY_HEADERS = ['x-vercel-ip-country', 'cf-ipcountry', 'x-country-code', 'x-geo-country'] as const

/** Countries where the underlying stock tokens are not offered. Override with BLOCKED_COUNTRIES="US,CA". */
export const DEFAULT_BLOCKED_COUNTRIES = 'US'

export function parseCountryList(v: string | undefined | null): Set<string> {
  return new Set(
    (v ?? '')
      .split(',')
      .map((c) => c.trim().toUpperCase())
      .filter((c) => /^[A-Z]{2}$/.test(c)),
  )
}

/** ISO-3166 alpha-2 from the first geo header present, or null when nothing in front of the app sets one. */
export function countryFrom(get: (name: string) => string | null | undefined): string | null {
  for (const h of COUNTRY_HEADERS) {
    const v = get(h)?.trim().toUpperCase()
    if (v && /^[A-Z]{2}$/.test(v) && v !== 'XX' && v !== 'T1') return v // XX / T1 = unknown / Tor on Cloudflare
  }
  return null
}

export function isBlockedCountry(country: string | null, blocked: Set<string>): boolean {
  return country != null && blocked.has(country)
}
