import { NextResponse, type NextRequest } from 'next/server'
import { DEFAULT_BLOCKED_COUNTRIES, countryFrom, isBlockedCountry, parseCountryList } from '@/lib/geo'

/**
 * Geo-block for the transactional routes. The country comes from the edge in front of the app
 * (Vercel / Cloudflare headers, or a GeoIP module on the reverse proxy); with no header the request
 * passes and the in-app attestation is the only gate. The marketing pages are never blocked.
 */
export function middleware(req: NextRequest) {
  const blocked = parseCountryList(process.env.BLOCKED_COUNTRIES ?? DEFAULT_BLOCKED_COUNTRIES)
  const country = countryFrom((h) => req.headers.get(h))
  if (isBlockedCountry(country, blocked)) {
    const url = req.nextUrl.clone()
    url.pathname = '/restricted'
    url.search = `?from=${encodeURIComponent(req.nextUrl.pathname)}`
    const res = NextResponse.redirect(url, 307)
    res.headers.set('x-halve-geo', country ?? '')
    return res
  }
  return NextResponse.next()
}

export const config = { matcher: ['/app/:path*', '/lend/:path*'] }
