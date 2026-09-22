'use client'
import { useSeries } from '@/hooks/useSeries'
import { useAllSeriesStats } from '@/hooks/useSeriesStats'
import { useMorphoMarkets } from '@/hooks/useMorphoMarkets'
import { MOCK } from '@/lib/env'
import { useToast } from '@/lib/toast'
import { f, usd } from '@/lib/format'
import { Banner, RPC_ERROR_TEXT, Skel } from './Skeleton'

/**
 * Morpho markets per PT. Reads Morpho Blue when configured (NEXT_PUBLIC_MORPHO_BLUE + morphoMarketId). The demo
 * derives supplied / borrowed from TVL; a live build without a market shows "—" and a closed button instead,
 * because no market exists to borrow from yet.
 */
export function LendMarkets() {
  const series = useSeries()
  const { stats, isError } = useAllSeriesStats()
  const morpho = useMorphoMarkets()
  const { toast } = useToast()
  const markets = series.map((s, i) => ({ s, st: stats[i], m: morpho.get(s.id) })).filter(({ s }) => s.lend)
  const live = !MOCK
  const noneOpen = live && markets.every(({ m }) => !m)
  return (
    <>
      {isError && <Banner kind="r">{RPC_ERROR_TEXT}</Banner>}
      {noneOpen && <Banner kind="y">No lending market is open yet. Each pPT / USDC market on Morpho opens after its series is live; the cards show the planned pairs only.</Banner>}
      <div className="lend" id="lendMk">
        {markets.map(({ s, st, m }) => (
          <div className="mk" key={s.id}>
            <div className="t"><div className="tk"><i aria-hidden="true">{s.ticker.slice(0, 2)}</i><div><b>p{s.ticker} / USDC</b><span>Morpho · Halve oracle</span></div></div><span className="pill i">{s.issuer}</span></div>
            <div className="row"><span>Max LTV</span><b>{m ? f(m.maxLtv * 100, 0) + '%' : live ? '—' : s.lend?.maxLtv}</b></div>
            <div className="row"><span>Borrow APR</span><b>{live && !m ? '—' : s.lend?.borrowApr}</b></div>
            <div className="row"><span>Supplied</span><b>{m ? usd(m.supplied) : live ? '—' : st.ready ? usd(st.tvlUsd * 0.6) : <Skel w={48} />}</b></div>
            <div className="row"><span>Borrowed</span><b>{m ? usd(m.borrowed) : live ? '—' : st.ready ? usd(st.tvlUsd * 0.35) : <Skel w={48} />}</b></div>
            <div className="row"><span>Oracle</span>{st.isSynced ? <b className="g">synced</b> : <b className="y">held</b>}</div>
            {live && !m
              ? <button className="btn btn-line" style={{ width: '100%', marginTop: 14 }} disabled>Market not open yet</button>
              : <button className="btn btn-white" style={{ width: '100%', marginTop: 14 }} onClick={() => toast(`Opening Morpho market for p${s.ticker}`)}>Borrow against p{s.ticker}</button>}
          </div>
        ))}
      </div>
    </>
  )
}
