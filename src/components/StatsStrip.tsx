'use client'
import { useMemo } from 'react'
import { issuerCount, useSeries } from '@/hooks/useSeries'
import { useAllSeriesStats } from '@/hooks/useSeriesStats'
import { usd } from '@/lib/format'
import { toNumber } from '@/lib/math'
import { MOCK_DIVIDENDS_DISTRIBUTED } from '@/lib/mock'
import { Skel } from './Skeleton'

export function StatsStrip() {
  const series = useSeries()
  const { stats, isLoading } = useAllSeriesStats()
  const { tvl, distributed, preview } = useMemo(() => {
    const tvl = stats.reduce((a, s) => a + s.tvlUsd, 0)
    // Live: dividends accrued to YT holders so far = Σ deposits × (index/d0 − 1) × USD price.
    const anyLive = stats.some((s) => !s.isMock)
    // Preview (real prices, no vaults yet): nothing has been split or distributed, so say so.
    const preview = !anyLive && stats.some((s) => s.isPreview)
    const distributed = anyLive
      ? stats.reduce((a, s) => a + (s.isMock ? 0 : toNumber(s.totalDeposits, s.decimals) * s.accrued * s.usdPrice), 0)
      : preview ? 0 : MOCK_DIVIDENDS_DISTRIBUTED
    return { tvl, distributed, preview }
  }, [stats])
  return (
    <div className="stats"><div className="wrap">
      <div><b id="sTvl">{isLoading ? <Skel w={90} /> : preview ? '—' : usd(tvl)}</b>{preview ? 'split so far · opens at launch' : 'total value split'}</div>
      <div><b>{series.length}</b>series {preview ? 'in preview' : 'live'} · {issuerCount(series)} issuers</div>
      <div><b>{isLoading ? <Skel w={80} /> : preview ? '—' : usd(distributed)}</b>dividends distributed</div>
      <div><b>0%</b>fee to merge</div>
    </div></div>
  )
}
