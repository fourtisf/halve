'use client'
import type { Series } from '@/contracts/types'
import type { PositionData, SeriesStats } from '@/lib/types'
import { f } from '@/lib/format'

/** "Your position" — PT/YT/LP balances; accrued dividends = ytBalance × (dividendIndex/d0 − 1) × usdPrice. */
export function Position({ series, stats, position: p }: { series: Series; stats: SeriesStats; position: PositionData }) {
  const t = series.ticker
  const empty = !p.connected || (!p.pt && !p.yt && !p.lp)
  return (
    <div className="panel" style={{ marginTop: 16 }}>
      <h4>Your position</h4>
      <div id="pos" className="meta" style={{ margin: 0 }}>
        {empty ? (
          <div><span>Nothing yet</span><b>—</b></div>
        ) : (<>
          <div><span>p{t}</span><b>{f(p.pt, 3)}</b></div>
          <div><span>y{t}</span><b>{f(p.yt, 3)}</b></div>
          {p.lp ? <div><span>LP</span><b>{f(p.lp, 3)}</b></div> : null}
          <div><span>Accrued dividends</span><b className="y">${f(p.yt * stats.accrued * stats.usdPrice, 2)}</b></div>
          <div><span>Redeems at maturity</span><b>{f(p.pt, 3)} {t}</b></div>
        </>)}
      </div>
    </div>
  )
}
