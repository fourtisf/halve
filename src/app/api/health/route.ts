import { NextResponse } from 'next/server'
import { createPublicClient, http } from 'viem'
import { SERIES, hasPlaceholderAddresses } from '@/contracts/types'
import { MOCK } from '@/lib/env'
import { CHAIN_ID, RPC_HTTP, robinhood } from '@/lib/chain'
import { historyBackend, lastSampleTs } from '@/lib/kv'
import pkg from '../../../../package.json'

export const dynamic = 'force-dynamic'

/**
 * GET /api/health → liveness for uptime monitors and pm2/Caddy checks.
 * 200 when the app can serve; 503 when live mode can't reach the RPC (mock mode never fails on RPC).
 */
export async function GET() {
  const live = SERIES.filter((s) => !hasPlaceholderAddresses(s))
  const t0 = Date.now()
  let rpc: { ok: boolean; block?: number; chainId?: number; latencyMs?: number; error?: string } = { ok: false }
  try {
    const client = createPublicClient({ chain: robinhood, transport: http(RPC_HTTP, { timeout: 5_000 }) })
    const [block, chainId] = await Promise.all([client.getBlockNumber(), client.getChainId()])
    rpc = { ok: chainId === CHAIN_ID, block: Number(block), chainId, latencyMs: Date.now() - t0 }
    if (!rpc.ok) rpc.error = `chain id ${chainId}, expected ${CHAIN_ID}`
  } catch (e) {
    rpc = { ok: false, latencyMs: Date.now() - t0, error: e instanceof Error ? e.message.split('\n')[0].slice(0, 200) : 'rpc error' }
  }
  const history = { backend: historyBackend(), lastSample: {} as Record<string, number | null> }
  for (const s of live) {
    try { history.lastSample[s.id] = await lastSampleTs(s.id) } catch { history.lastSample[s.id] = null }
  }
  const ok = MOCK || live.length === 0 || rpc.ok
  const body = {
    ok,
    ts: Math.floor(Date.now() / 1000),
    version: pkg.version,
    commit: process.env.GIT_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    mock: MOCK,
    chainId: CHAIN_ID,
    rpc,
    series: { total: SERIES.length, live: live.length, ids: live.map((s) => s.id) },
    history,
  }
  return NextResponse.json(body, { status: ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } })
}
