'use client'
import type { SeriesStats } from '@/lib/types'
import { f, usd } from '@/lib/format'
import { Skel } from './Skeleton'

export function KPIs({ stats, ytChange24h, tvlChange7d }: { stats: SeriesStats; ytChange24h: number | null; tvlChange7d: number | null }) {
  const r = stats.ready
  const sign = (n: number) => (n >= 0 ? '+' : '') + f(n, 1) + '%'
  const tvl7 = stats.tvlChange7d ?? tvlChange7d
  const pv = !!stats.isPreview // live price, no vault yet: never show an invented TVL or accrual
  return (
    <div className="kpis">
      <div className="kpi"><small>Total split</small><b id="kTvl">{r ? pv ? '—' : usd(stats.tvlUsd) : <Skel w={64} />}</b><em>{pv ? 'opens at launch' : tvl7 != null ? `${sign(tvl7)} 7d` : `${Math.round(stats.capacityUsed * 100)}% of cap`}</em></div>
      <div className="kpi"><small>Fixed APY · PT</small><b id="kApy">{r ? f(stats.fixedApy * 100, 1) + '%' : <Skel w={48} />}</b><em>{pv ? 'indicative · to maturity' : 'to maturity'}</em></div>
      <div className="kpi"><small>YT price</small><b id="kYt">{r ? f(stats.ytPrice, 3) : <Skel w={48} />}</b><em id="kYtChg">{pv ? 'indicative · in stock' : ytChange24h != null ? `${sign(ytChange24h)} 24h` : 'in stock'}</em></div>
      <div className="kpi"><small>Dividends accrued</small><b id="kAcc">{r ? pv ? '—' : f(stats.accrued * 100, 1) + '%' : <Skel w={40} />}</b><em id="kEv">{pv ? 'from launch' : `${stats.events} events`}</em></div>
    </div>
  )
}
