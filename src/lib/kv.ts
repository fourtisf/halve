/**
 * Server-only KV access for the YT price / TVL series (Vercel KV or Upstash Redis via REST).
 * One sorted set per series: key halve:hist:<id>, score = unix seconds, member = JSON sample.
 */
import { Redis } from '@upstash/redis'
import { CHART_DAYS } from '@/contracts/constants'
import type { Sample } from './history'

let client: Redis | null | undefined

export function getRedis(): Redis | null {
  if (client !== undefined) return client
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
  client = url && token ? new Redis({ url, token }) : null
  return client
}

export const historyKey = (id: string) => `halve:hist:${id}`

export async function readHistory(id: string, now = Math.floor(Date.now() / 1000)): Promise<Sample[]> {
  const r = getRedis()
  if (!r) return []
  const since = now - (CHART_DAYS + 1) * 86_400
  const raw = await r.zrange<(string | Sample)[]>(historyKey(id), since, '+inf', { byScore: true })
  return raw
    .map((m) => (typeof m === 'string' ? (JSON.parse(m) as Sample) : m))
    .filter((s) => typeof s?.t === 'number' && typeof s?.yt === 'number')
    .sort((a, b) => a.t - b.t)
}

export async function appendSample(id: string, s: Sample): Promise<void> {
  const r = getRedis()
  if (!r) return
  const key = historyKey(id)
  await r.zadd(key, { score: s.t, member: JSON.stringify(s) })
  await r.zremrangebyscore(key, 0, s.t - (CHART_DAYS + 2) * 86_400)
}

export async function lastSampleTs(id: string): Promise<number | null> {
  const r = getRedis()
  if (!r) return null
  const last = await r.zrange<(string | Sample)[]>(historyKey(id), -1, -1)
  const m = last[0]
  if (!m) return null
  const s = typeof m === 'string' ? (JSON.parse(m) as Sample) : m
  return s.t
}
