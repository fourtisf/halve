/**
 * Server-only store for the YT price / TVL series.
 * Backend 1: Vercel KV / Upstash Redis via REST (KV_REST_API_* or UPSTASH_REDIS_REST_*).
 * Backend 2 (default when no Redis is configured): JSON files under HISTORY_DIR (./data/history),
 * which is enough for a single-process VPS deployment and needs no external service.
 * One series per key/file; samples are { t, yt, tvl } sorted by t.
 */
import { Redis } from '@upstash/redis'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { CHART_DAYS } from '@/contracts/constants'
import type { Sample } from './history'

const RETENTION_S = (CHART_DAYS + 2) * 86_400

let client: Redis | null | undefined
export function getRedis(): Redis | null {
  if (client !== undefined) return client
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
  client = url && token ? new Redis({ url, token }) : null
  return client
}

export const historyKey = (id: string) => `halve:hist:${id}`
export const historyBackend = (): 'redis' | 'file' => (getRedis() ? 'redis' : 'file')

const parse = (m: string | Sample): Sample => (typeof m === 'string' ? (JSON.parse(m) as Sample) : m)
const valid = (s: Sample | undefined): s is Sample => !!s && typeof s.t === 'number' && typeof s.yt === 'number'

// ---- file backend ----
const dir = () => process.env.HISTORY_DIR || path.join(process.cwd(), 'data', 'history')
const fileFor = (id: string) => path.join(dir(), `${id.replace(/[^A-Za-z0-9_-]/g, '_')}.json`)

/** A missing file is an empty history; a corrupt one is an error for writers (so it is never overwritten) and empty for readers. */
async function fileRead(id: string, strict = false): Promise<Sample[]> {
  let text: string
  try {
    text = await readFile(fileFor(id), 'utf8')
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return []
    if (strict) throw e
    return []
  }
  try {
    const raw = JSON.parse(text) as Sample[]
    return raw.filter(valid).sort((a, b) => a.t - b.t)
  } catch (e) {
    if (strict) throw new Error(`history file for ${id} is not valid JSON: ${(e as Error).message}`)
    return []
  }
}

/** Write to a private temp name, then rename: concurrent writers cannot see each other's half-written file. */
async function fileWrite(id: string, samples: Sample[]): Promise<void> {
  await mkdir(dir(), { recursive: true })
  const f = fileFor(id)
  const tmp = `${f}.${process.pid}.${randomUUID()}.tmp`
  await writeFile(tmp, JSON.stringify(samples))
  await rename(tmp, f)
}

/** One append at a time per series: the read-modify-write below is not atomic on its own. */
const appending = new Map<string, Promise<void>>()

// ---- public API (backend-agnostic) ----
export async function readHistory(id: string, now = Math.floor(Date.now() / 1000)): Promise<Sample[]> {
  const since = now - (CHART_DAYS + 1) * 86_400
  const r = getRedis()
  if (!r) return (await fileRead(id)).filter((s) => s.t >= since)
  const raw = await r.zrange<(string | Sample)[]>(historyKey(id), since, '+inf', { byScore: true })
  return raw.map(parse).filter(valid).sort((a, b) => a.t - b.t)
}

export async function appendSample(id: string, s: Sample): Promise<void> {
  const r = getRedis()
  if (!r) {
    const run = (appending.get(id) ?? Promise.resolve()).then(async () => {
      const all = (await fileRead(id, true)).filter((x) => x.t >= s.t - RETENTION_S && x.t !== s.t)
      all.push(s)
      all.sort((a, b) => a.t - b.t)
      await fileWrite(id, all)
    })
    appending.set(id, run.catch(() => undefined))
    return run
  }
  const key = historyKey(id)
  await r.zadd(key, { score: s.t, member: JSON.stringify(s) })
  await r.zremrangebyscore(key, 0, s.t - RETENTION_S)
}

export async function lastSampleTs(id: string): Promise<number | null> {
  const r = getRedis()
  if (!r) {
    const all = await fileRead(id)
    return all.length ? all[all.length - 1].t : null
  }
  const last = await r.zrange<(string | Sample)[]>(historyKey(id), -1, -1)
  return last[0] ? parse(last[0]).t : null
}
