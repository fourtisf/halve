import { NextResponse } from 'next/server'
import { getMarket } from '@/lib/market-server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/market → real share prices, 30-day closes and trailing dividend yields for every ticker in
 * series.json, plus ETH-USD. Cached one minute server-side; `source: "off"` when LIVE_MARKET=false.
 */
export async function GET() {
  const data = await getMarket()
  return NextResponse.json(data, { headers: { 'Cache-Control': 'public, max-age=30' } })
}
