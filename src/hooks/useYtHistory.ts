'use client'
import { useQuery } from '@tanstack/react-query'
import { usePublicClient } from 'wagmi'
import { getAbiItem, type PublicClient } from 'viem'
import type { Series } from '@/contracts/types'
import { uniswapV3PoolAbi } from '@/contracts/abis'
import { CHART_DAYS, CHART_POINTS } from '@/contracts/constants'
import { BLOCK_TIME_MS } from '@/lib/env'
import { MOCK_CHART_CHANGE, MOCK_TVL_CHANGE_7D, MOCK_YT_CHANGE_24H, mockChart } from '@/lib/mock'
import { poolPrice } from '@/lib/math'
import { resample, type Resampled, type Sample } from '@/lib/history'
import { CHAIN_ID } from '@/lib/wagmi'
import { isMockSeries } from './useSeries'

export type YtHistory = Resampled & { source: 'kv' | 'logs' | 'mock' | 'none'; isMock: boolean }

const swapEvent = getAbiItem({ abi: uniswapV3PoolAbi, name: 'Swap' })
const EMPTY: YtHistory = { points: [], days: CHART_DAYS, changePct: null, change24hPct: null, tvlChange7dPct: null, source: 'none', isMock: false }

/** 1. KV series (sampled slot0 every poll, see /api/yt-history). */
async function fromKv(s: Series): Promise<YtHistory | null> {
  const r = await fetch(`/api/yt-history/${s.id}`, { cache: 'no-store' })
  if (!r.ok) return null
  const { samples } = (await r.json()) as { samples: Sample[] }
  if (!samples || samples.length < 2) return null
  return { ...resample(samples, Date.now() / 1000), source: 'kv', isMock: false }
}

/** 2. Fallback: build the line from the YT pool's Swap events (shrinks the window if the RPC rejects the range). */
async function fromLogs(client: PublicClient, s: Series): Promise<YtHistory> {
  const latest = await client.getBlockNumber()
  const [token0, slot0] = await Promise.all([
    client.readContract({ address: s.poolYT, abi: uniswapV3PoolAbi, functionName: 'token0' }),
    client.readContract({ address: s.poolYT, abi: uniswapV3PoolAbi, functionName: 'slot0' }),
  ])
  const ytIsToken0 = token0.toLowerCase() === s.yt.toLowerCase()
  const price = (sqrt: bigint) => poolPrice(sqrt, ytIsToken0, s.decimals, s.decimals)
  const current = price(slot0[0])
  const blocksPerDay = BigInt(Math.max(1, Math.round(86_400_000 / BLOCK_TIME_MS)))

  for (const days of [CHART_DAYS, 7, 1]) {
    const span = blocksPerDay * BigInt(days)
    const from = latest > span ? latest - span : 0n
    try {
      const logs = await client.getLogs({ address: s.poolYT, event: swapEvent, fromBlock: from, toBlock: latest })
      const bucket = (latest - from) / BigInt(CHART_DAYS) || 1n
      const last: (number | null)[] = Array(CHART_POINTS).fill(null)
      for (const log of logs) {
        if (log.blockNumber == null || log.args.sqrtPriceX96 == null) continue
        const i = Math.min(CHART_DAYS, Number((log.blockNumber - from) / bucket))
        last[i] = price(log.args.sqrtPriceX96)
      }
      last[CHART_DAYS] = current
      const firstKnown = last.find((v) => v != null) ?? current
      const points: number[] = []
      let prev = firstKnown
      for (let i = 0; i < CHART_POINTS; i++) { prev = last[i] ?? prev; points.push(prev) }
      const back = Math.min(CHART_POINTS - 1, Math.max(1, Math.round(CHART_DAYS / days)))
      const p24 = points[CHART_POINTS - 1 - back]
      return {
        points, days, source: 'logs', isMock: false, tvlChange7dPct: null,
        changePct: points[0] > 0 ? (points[CHART_POINTS - 1] / points[0] - 1) * 100 : null,
        change24hPct: p24 > 0 ? (points[CHART_POINTS - 1] / p24 - 1) * 100 : null,
      }
    } catch {
      continue
    }
  }
  return { ...EMPTY, points: Array(CHART_POINTS).fill(current), days: 0 }
}

export function useYtHistory(series: Series, seriesIndex: number): YtHistory {
  const mock = isMockSeries(series)
  const client = usePublicClient({ chainId: CHAIN_ID })
  const q = useQuery({
    queryKey: ['ytHistory', series.id],
    queryFn: async () => {
      try { const kv = await fromKv(series); if (kv) return kv } catch { /* fall through */ }
      return fromLogs(client as PublicClient, series)
    },
    enabled: !mock && !!client,
    refetchInterval: 60_000,
    staleTime: 30_000,
  })
  if (mock) {
    return { points: mockChart(seriesIndex), days: CHART_DAYS, changePct: MOCK_CHART_CHANGE, change24hPct: MOCK_YT_CHANGE_24H, tvlChange7dPct: MOCK_TVL_CHANGE_7D, source: 'mock', isMock: true }
  }
  return q.data ?? EMPTY
}
