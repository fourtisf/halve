'use client'
import type { SeriesStats } from '@/lib/types'
import { f, usd } from '@/lib/format'

export function KPIs({ stats, ytChange24h }: { stats: SeriesStats; ytChange24h: number | null }) {
  const r = stats.ready
  const sign = (n: number) => (n >= 0 ? '+' : '') + f(n, 1) + '%'
  return (
    <div className="kpis">
      <div className="kpi"><small>Total split</small><b id="kTvl">{r ? usd(stats.tvlUsd) : '—'}</b><em>{stats.tvlChange7d != null ? `${sign(stats.tvlChange7d)} 7d` : `${Math.round(stats.capacityUsed * 100)}% of cap`}</em></div>
      <div className="kpi"><small>Fixed APY · PT</small><b id="kApy">{r ? f(stats.fixedApy * 100, 1) + '%' : '—'}</b><em>to maturity</em></div>
      <div className="kpi"><small>YT price</small><b id="kYt">{r ? f(stats.ytPrice, 3) : '—'}</b><em id="kYtChg">{ytChange24h != null ? `${sign(ytChange24h)} 24h` : 'in stock'}</em></div>
      <div className="kpi"><small>Dividends accrued</small><b id="kAcc">{r ? f(stats.accrued * 100, 1) + '%' : '—'}</b><em id="kEv">{stats.events} events</em></div>
    </div>
  )
}
