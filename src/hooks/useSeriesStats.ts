'use client'
import { useMemo } from 'react'
import { useReadContracts } from 'wagmi'
import { SERIES, type Series } from '@/contracts/types'
import { POLL_MS } from '@/contracts/constants'
import { mockStats } from '@/lib/mock'
import type { SeriesStats } from '@/lib/types'
import { parseStats, statsContracts, STATS_PER_SERIES, type ReadResult } from '@/lib/stats'
import { isMockSeries } from './useSeries'

export type AllStats = {
  stats: SeriesStats[] // aligned with SERIES
  isLoading: boolean
  isError: boolean
  error: Error | null
  anyLive: boolean
}

/**
 * Stats for every series in series.json, one multicall, polled every 12s.
 * Series with placeholder addresses (or MOCK=true) return the prototype's mock numbers.
 */
export function useAllSeriesStats(): AllStats {
  const live = useMemo(() => SERIES.filter((s) => !isMockSeries(s)), [])
  const contracts = useMemo(() => live.flatMap(statsContracts), [live])
  const { data, isLoading, isError, error } = useReadContracts({
    contracts,
    allowFailure: true,
    query: { enabled: contracts.length > 0, refetchInterval: POLL_MS },
  })
  return useMemo(() => {
    const now = Date.now() / 1000
    let li = 0
    const stats = SERIES.map((s) =>
      isMockSeries(s) ? mockStats(s) : parseStats(s, data as readonly ReadResult[] | undefined, li++ * STATS_PER_SERIES, now),
    )
    return { stats, isLoading: live.length > 0 && isLoading, isError: live.length > 0 && isError, error: (error as Error | null) ?? null, anyLive: live.length > 0 }
  }, [data, isLoading, isError, error, live.length])
}

export function useSeriesStats(series: Series): SeriesStats {
  const { stats } = useAllSeriesStats()
  const i = SERIES.findIndex((s) => s.id === series.id)
  return stats[i] ?? mockStats(series)
}
