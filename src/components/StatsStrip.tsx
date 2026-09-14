'use client'
import { useMemo } from 'react'
import { issuerCount, useSeries } from '@/hooks/useSeries'
import { useAllSeriesStats } from '@/hooks/useSeriesStats'
import { usd } from '@/lib/format'
import { toNumber } from '@/lib/math'
import { MOCK_DIVIDENDS_DISTRIBUTED } from '@/lib/mock'

export function StatsStrip() {
  const series = useSeries()
  const stats = useAllSeriesStats()
  const { tvl, distributed } = useMemo(() => {
    const tvl = stats.reduce((a, s) => a + s.tvlUsd, 0)
    // Live: dividends accrued to YT holders so far = Σ deposits × (index/d0 − 1) × USD price.
    const anyLive = stats.some((s) => !s.isMock)
    const distributed = anyLive
      ? stats.reduce((a, s) => a + (s.isMock ? 0 : toNumber(s.totalDeposits, s.decimals) * s.accrued * s.usdPrice), 0)
      : MOCK_DIVIDENDS_DISTRIBUTED
    return { tvl, distributed }
  }, [stats])
  return (
    <div className="stats"><div className="wrap">
      <div><b id="sTvl">{usd(tvl)}</b>total value split</div>
      <div><b>{series.length}</b>series live · {issuerCount(series)} issuers</div>
      <div><b>{usd(distributed)}</b>dividends distributed</div>
      <div><b>0%</b>fee to merge</div>
    </div></div>
  )
}
