'use client'
import { useSeries } from '@/hooks/useSeries'
import { useAllSeriesStats } from '@/hooks/useSeriesStats'
import { useMorphoMarkets } from '@/hooks/useMorphoMarkets'
import { useToast } from '@/lib/toast'
import { f, usd } from '@/lib/format'
import { Banner, RPC_ERROR_TEXT, Skel } from './Skeleton'

/** Morpho markets per PT. Reads Morpho Blue when configured; otherwise supplied/borrowed derive from TVL. */
export function LendMarkets() {
  const series = useSeries()
  const { stats, isError } = useAllSeriesStats()
  const morpho = useMorphoMarkets()
  const { toast } = useToast()
  const markets = series.map((s, i) => ({ s, st: stats[i], m: morpho.get(s.id) })).filter(({ s }) => s.lend)
  return (
    <>
      {isError && <Banner kind="r">{RPC_ERROR_TEXT}</Banner>}
      <div className="lend" id="lendMk">
        {markets.map(({ s, st, m }) => (
          <div className="mk" key={s.id}>
            <div className="t"><div className="tk"><i aria-hidden="true">{s.ticker.slice(0, 2)}</i><div><b>p{s.ticker} / USDC</b><span>Morpho · Halve oracle</span></div></div><span className="pill i">{s.issuer}</span></div>
            <div className="row"><span>Max LTV</span><b>{m ? f(m.maxLtv * 100, 0) + '%' : s.lend?.maxLtv}</b></div>
            <div className="row"><span>Borrow APR</span><b>{s.lend?.borrowApr}</b></div>
            <div className="row"><span>Supplied</span><b>{m ? usd(m.supplied) : st.ready ? usd(st.tvlUsd * 0.6) : <Skel w={48} />}</b></div>
            <div className="row"><span>Borrowed</span><b>{m ? usd(m.borrowed) : st.ready ? usd(st.tvlUsd * 0.35) : <Skel w={48} />}</b></div>
            <div className="row"><span>Oracle</span>{st.isSynced ? <b className="g">synced</b> : <b className="y">held</b>}</div>
            <button className="btn btn-white" style={{ width: '100%', marginTop: 14 }} onClick={() => toast(`Opening Morpho market for p${s.ticker}`)}>Borrow against p{s.ticker}</button>
          </div>
        ))}
      </div>
    </>
  )
}
