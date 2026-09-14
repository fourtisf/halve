'use client'
import { useSeries } from '@/hooks/useSeries'
import { useAllSeriesStats } from '@/hooks/useSeriesStats'
import { useToast } from '@/lib/toast'
import { usd } from '@/lib/format'

/** Morpho markets per PT. Supplied/borrowed are derived from TVL until Morpho reads land (phase 2). */
export function LendMarkets() {
  const series = useSeries()
  const stats = useAllSeriesStats()
  const { toast } = useToast()
  const markets = series.map((s, i) => ({ s, st: stats[i] })).filter(({ s }) => s.lend)
  return (
    <div className="lend" id="lendMk">
      {markets.map(({ s, st }) => (
        <div className="mk" key={s.id}>
          <div className="t"><div className="tk"><i>{s.ticker.slice(0, 2)}</i><div><b>p{s.ticker} / USDC</b><span>Morpho · Halve oracle</span></div></div><span className="pill i">{s.issuer}</span></div>
          <div className="row"><span>Max LTV</span><b>{s.lend?.maxLtv}</b></div>
          <div className="row"><span>Borrow APR</span><b>{s.lend?.borrowApr}</b></div>
          <div className="row"><span>Supplied</span><b>{usd(st.tvlUsd * 0.6)}</b></div>
          <div className="row"><span>Borrowed</span><b>{usd(st.tvlUsd * 0.35)}</b></div>
          <div className="row"><span>Oracle</span>{st.isSynced ? <b className="g">synced</b> : <b className="y">held</b>}</div>
          <button className="btn btn-white" style={{ width: '100%', marginTop: 14 }} onClick={() => toast(`Opening Morpho market for p${s.ticker}`)}>Borrow against p{s.ticker}</button>
        </div>
      ))}
    </div>
  )
}
