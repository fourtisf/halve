import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { historyBackend } from '@/lib/kv'
import { takeSamples } from '@/lib/sampler'

export const dynamic = 'force-dynamic'

/**
 * Cron target (Vercel Cron via vercel.json, or a crontab hitting this URL on a VPS). Requires CRON_SECRET as a
 * bearer token: without one the route is off, because a forced sample costs an RPC round trip and a file rewrite.
 * The read-through sampler on /api/yt-history keeps the chart fed either way.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET not set' }, { status: 503 })
  const got = Buffer.from(req.headers.get('authorization') ?? '')
  const want = Buffer.from(`Bearer ${secret}`)
  if (got.length !== want.length || !timingSafeEqual(got, want)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  try {
    const out = await takeSamples(undefined, true)
    return NextResponse.json({ ok: true, backend: historyBackend(), ...out })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
