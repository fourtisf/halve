'use client'
import { useQuery } from '@tanstack/react-query'
import { usePublicClient } from 'wagmi'
import { getAbiItem, type PublicClient } from 'viem'
import type { Series } from '@/contracts/types'
import { uniswapV3PoolAbi } from '@/contracts/abis'
import { CHART_DAYS } from '@/contracts/constants'
import { BLOCK_TIME_MS } from '@/lib/env'
import { MOCK_CHART_CHANGE, MOCK_YT_CHANGE_24H, mockChart } from '@/lib/mock'
import { poolPrice } from '@/lib/math'
import { CHAIN_ID } from '@/lib/wagmi'
import { isMockSeries } from './useSeries'

export type YtHistory = {
  points: number[] // 31 points, oldest → newest (newest = current slot0 price)
  days: number // window actually covered (30, 7, 1 — or 0 if no swap logs could be read)
  changePct: number | null // last / first − 1, percent
  change24hPct: number | null
  isMock: boolean
}

const swapEvent = getAbiItem({ abi: uniswapV3PoolAbi, name: 'Swap' })
const POINTS = CHART_DAYS + 1

/**
 * Phase 1: build the 30d YT price line from the YT pool's Swap events (sqrtPriceX96 → price in stock).
 * Falls back to shorter windows when the RPC rejects the log range. Phase 2 replaces this with a KV series.
 */
async function fetchHistory(client: PublicClient, s: Series): Promise<Omit<YtHistory, 'isMock'>> {
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
      const last: (number | null)[] = Array(POINTS).fill(null)
      for (const log of logs) {
        if (log.blockNumber == null || log.args.sqrtPriceX96 == null) continue
        const i = Math.min(CHART_DAYS, Number((log.blockNumber - from) / bucket))
        last[i] = price(log.args.sqrtPriceX96)
      }
      last[CHART_DAYS] = current
      const firstKnown = last.find((v) => v != null) ?? current
      const points: number[] = []
      let prev = firstKnown
      for (let i = 0; i < POINTS; i++) {
        prev = last[i] ?? prev
        points.push(prev)
      }
      const dayBuckets = CHART_DAYS / days // buckets per calendar day in this window
      const back = Math.min(POINTS - 1, Math.max(1, Math.round(dayBuckets)))
      const p24 = points[POINTS - 1 - back]
      return {
        points,
        days,
        changePct: points[0] > 0 ? (points[POINTS - 1] / points[0] - 1) * 100 : null,
        change24hPct: p24 > 0 ? (points[POINTS - 1] / p24 - 1) * 100 : null,
      }
    } catch {
      continue
    }
  }
  return { points: Array(POINTS).fill(current), days: 0, changePct: null, change24hPct: null }
}

export function useYtHistory(series: Series, seriesIndex: number): YtHistory {
  const mock = isMockSeries(series)
  const client = usePublicClient({ chainId: CHAIN_ID })
  const q = useQuery({
    queryKey: ['ytHistory', series.id],
    queryFn: () => fetchHistory(client as PublicClient, series),
    enabled: !mock && !!client,
    refetchInterval: 60_000,
    staleTime: 30_000,
  })
  if (mock) return { points: mockChart(seriesIndex), days: CHART_DAYS, changePct: MOCK_CHART_CHANGE, change24hPct: MOCK_YT_CHANGE_24H, isMock: true }
  return q.data ? { ...q.data, isMock: false } : { points: [], days: CHART_DAYS, changePct: null, change24hPct: null, isMock: false }
}
