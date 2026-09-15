/** Country-level access control for the transactional routes (/app, /lend). Pure; unit-tested. */

/** Headers the usual edges set: Vercel, Cloudflare, or a GeoIP module on the reverse proxy (Caddy / nginx). */
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

/**
 * The ONE header this deployment trusts. Reading several would let a client pick whichever the edge does not
 * overwrite, so it is GEO_HEADER when set, else Vercel's own header on Vercel (the platform overwrites it),
 * else X-Country-Code from the reverse proxy's GeoIP module (which must strip the client's copy first).
 */
export function geoHeader(env: { GEO_HEADER?: string; VERCEL?: string }): string {
  const h = env.GEO_HEADER?.trim().toLowerCase()
  if (h) return h
  return env.VERCEL ? 'x-vercel-ip-country' : 'x-country-code'
}

/** ISO-3166 alpha-2 from the trusted header, or null when it is absent or unknown (XX / T1 on Cloudflare). */
export function countryFrom(get: (name: string) => string | null | undefined, header: string): string | null {
  const v = get(header)?.trim().toUpperCase()
  return v && /^[A-Z]{2}$/.test(v) && v !== 'XX' && v !== 'T1' ? v : null
}

export function isBlockedCountry(country: string | null, blocked: Set<string>): boolean {
  return country != null && blocked.has(country)
}
