import { NextResponse } from 'next/server'
import { seriesById, hasPlaceholderAddresses } from '@/contracts/types'
import { readHistory } from '@/lib/kv'
import { takeSamples } from '@/lib/sampler'

export const dynamic = 'force-dynamic'

/**
 * GET /api/yt-history/:id → { samples: [{ t, yt, tvl }] } over the last 30 days.
 * Read-through sampling: if the newest sample is stale, one is taken first, so the series fills
 * from traffic alone even without a cron. Storage is Redis when configured, else JSON files.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const s = seriesById(id)
  if (!s) return NextResponse.json({ error: 'unknown series' }, { status: 404 })
  if (hasPlaceholderAddresses(s)) return NextResponse.json({ samples: [] })
  try {
    await takeSamples([id])
  } catch {
    // sampling is best-effort; serve whatever history exists
  }
  let samples: Awaited<ReturnType<typeof readHistory>> = []
  try {
    samples = await readHistory(id)
  } catch (e) {
    console.error(`yt-history ${id}: ${e instanceof Error ? e.message : e}`) // the client falls back to pool events
  }
  return NextResponse.json({ samples }, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } })
}
