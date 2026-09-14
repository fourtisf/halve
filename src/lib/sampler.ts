/** Server-side sampler: reads slot0 / TVL / price for every live series and appends one KV sample each. */
import { createPublicClient, http } from 'viem'
import { SERIES, hasPlaceholderAddresses } from '@/contracts/types'
import { SAMPLE_INTERVAL_S } from '@/contracts/constants'
import { RPC_HTTP, robinhood } from './chain'
import { parseStats, statsContracts, STATS_PER_SERIES, type ReadResult } from './stats'
import { appendSample, lastSampleTs } from './kv'
import type { Sample } from './history'

export function liveSeries() {
  return SERIES.filter((s) => !hasPlaceholderAddresses(s))
}

export async function takeSamples(ids?: string[], force = false): Promise<{ sampled: string[]; skipped: string[] }> {
  const now = Math.floor(Date.now() / 1000)
  const targets = liveSeries().filter((s) => !ids || ids.includes(s.id))
  const sampled: string[] = []
  const skipped: string[] = []
  const due = []
  for (const s of targets) {
    const last = force ? null : await lastSampleTs(s.id)
    if (last != null && now - last < SAMPLE_INTERVAL_S) skipped.push(s.id)
    else due.push(s)
  }
  if (due.length === 0) return { sampled, skipped }
  const client = createPublicClient({ chain: robinhood, transport: http(RPC_HTTP) })
  const results = (await client.multicall({ contracts: due.flatMap(statsContracts), allowFailure: true })) as readonly ReadResult[]
  for (let i = 0; i < due.length; i++) {
    const st = parseStats(due[i], results, i * STATS_PER_SERIES, now)
    if (!st.ready) { skipped.push(due[i].id); continue }
    const sample: Sample = { t: now, yt: st.ytPrice, tvl: st.tvlUsd }
    await appendSample(due[i].id, sample)
    sampled.push(due[i].id)
  }
  return { sampled, skipped }
}
