import { NextResponse, type NextRequest } from 'next/server'
import { DEFAULT_BLOCKED_COUNTRIES, countryFrom, geoHeader, isBlockedCountry, parseCountryList } from '@/lib/geo'

/**
 * Geo-block for the transactional routes. The country comes from ONE trusted header set by the edge in front of
 * the app (GEO_HEADER; see lib/geo.ts for the defaults and docs/OPERATIONS.md for the Caddy lines that strip the
 * client's copies). With no header the request passes unless GEO_REQUIRED=1. The marketing pages are never blocked.
 */
export function middleware(req: NextRequest) {
  const blocked = parseCountryList(process.env.BLOCKED_COUNTRIES ?? DEFAULT_BLOCKED_COUNTRIES)
  const header = geoHeader({ GEO_HEADER: process.env.GEO_HEADER, VERCEL: process.env.VERCEL })
  const country = countryFrom((h) => req.headers.get(h), header)
  const required = process.env.GEO_REQUIRED === '1'
  if (isBlockedCountry(country, blocked) || (required && country === null)) {
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
