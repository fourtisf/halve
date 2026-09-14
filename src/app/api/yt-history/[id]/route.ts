import { NextResponse } from 'next/server'
import { seriesById, hasPlaceholderAddresses } from '@/contracts/types'
import { getRedis, readHistory } from '@/lib/kv'
import { takeSamples } from '@/lib/sampler'

export const dynamic = 'force-dynamic'

/**
 * GET /api/yt-history/:id → { samples: [{ t, yt, tvl }] } over the last 30 days.
 * Read-through sampling: if the newest sample is stale, one is taken first, so the series fills
 * from traffic alone even without a cron (Vercel Hobby only allows daily crons).
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const s = seriesById(id)
  if (!s) return NextResponse.json({ error: 'unknown series' }, { status: 404 })
  if (!getRedis()) return NextResponse.json({ error: 'KV not configured' }, { status: 503 })
  if (hasPlaceholderAddresses(s)) return NextResponse.json({ samples: [] })
  try {
    await takeSamples([id])
  } catch {
    // sampling is best-effort; serve whatever history exists
  }
  const samples = await readHistory(id)
  return NextResponse.json({ samples }, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } })
}
