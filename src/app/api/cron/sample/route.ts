import { NextResponse } from 'next/server'
import { historyBackend } from '@/lib/kv'
import { takeSamples } from '@/lib/sampler'

export const dynamic = 'force-dynamic'

/** Cron target (Vercel Cron via vercel.json, or a crontab hitting this URL on a VPS). Protected by CRON_SECRET when set. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  try {
    const out = await takeSamples(undefined, true)
    return NextResponse.json({ ok: true, backend: historyBackend(), ...out })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
