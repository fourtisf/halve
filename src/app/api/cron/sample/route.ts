import { NextResponse } from 'next/server'
import { getRedis } from '@/lib/kv'
import { takeSamples } from '@/lib/sampler'

export const dynamic = 'force-dynamic'

/** Vercel Cron target (see vercel.json). Protected by CRON_SECRET when set. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (!getRedis()) return NextResponse.json({ error: 'KV not configured' }, { status: 503 })
  try {
    const out = await takeSamples(undefined, true)
    return NextResponse.json({ ok: true, ...out })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
