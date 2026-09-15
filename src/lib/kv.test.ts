import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { appendSample, historyBackend, lastSampleTs, readHistory } from './kv'

let dir: string
beforeAll(async () => { dir = await mkdtemp(path.join(os.tmpdir(), 'halve-hist-')); process.env.HISTORY_DIR = dir })
afterAll(async () => { await rm(dir, { recursive: true, force: true }) })

describe('file-backed history store (no Redis configured)', () => {
  const now = 2_000_000_000
  it('uses the file backend when no Redis env is set', () => {
    expect(historyBackend()).toBe('file')
  })
  it('appends, sorts, dedupes by timestamp and reads back within the window', async () => {
    await appendSample('T-MAR27', { t: now - 10, yt: 0.041, tvl: 1e6 })
    await appendSample('T-MAR27', { t: now - 40 * 86_400, yt: 0.03, tvl: 9e5 }) // older than retention → dropped on next append
    await appendSample('T-MAR27', { t: now, yt: 0.042, tvl: 1.1e6 })
    await appendSample('T-MAR27', { t: now, yt: 0.043, tvl: 1.2e6 }) // same t replaces
    const all = await readHistory('T-MAR27', now)
    expect(all.map((s) => s.t)).toEqual([now - 10, now])
    expect(all[1].yt).toBe(0.043)
    expect(await lastSampleTs('T-MAR27')).toBe(now)
    expect(await lastSampleTs('NOPE')).toBeNull()
    expect(await readHistory('NOPE', now)).toEqual([])
  })
})
