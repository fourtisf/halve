'use client'
import { useSeries } from '@/hooks/useSeries'
import { useAllSeriesStats } from '@/hooks/useSeriesStats'
import { useAllPositions } from '@/hooks/useAllPositions'
import { useWalletModal } from '@/lib/walletModal'
import { f, monthYear } from '@/lib/format'
import { principalPerPT } from '@/lib/math'
import { ytClaim } from '@/lib/redeem'
import { Skel } from './Skeleton'

/** Portfolio tab: every series with the wallet's PT / YT balances and accrued dividends. */
export function Portfolio() {
  const series = useSeries()
  const { stats } = useAllSeriesStats()
  const { rows, connected, isLoading } = useAllPositions()
  const { open } = useWalletModal()
  const held = rows.map((r, i) => ({ r, s: series[i], st: stats[i] })).filter(({ r }) => r.pt > 0 || r.yt > 0 || r.lp > 0)
  const totals = held.reduce(
    (a, { r, st }) => ({ accrued: a.accrued + ytClaim(r.yt, st.accrued) * st.usdPrice, value: a.value + (r.pt * st.ptPrice + r.yt * st.ytPrice) * st.usdPrice }),
    { accrued: 0, value: 0 },
  )
  return (
    <div className="panel" id="portfolio">
      <h4>Portfolio <span>{connected ? `${held.length} series` : 'wallet not connected'}</span></h4>
      {!connected ? (
        <div className="meta" style={{ margin: 0 }}>
          <div><span>Connect a wallet to see your PT, YT and accrued dividends across every series.</span></div>
          <button className="btn btn-white" style={{ width: '100%', height: 42, marginTop: 8 }} onClick={open}>Connect wallet</button>
        </div>
      ) : isLoading ? (
        <div className="meta" style={{ margin: 0 }}><div><span>Loading balances</span><b><Skel w={60} /></b></div></div>
      ) : held.length === 0 ? (
        <div className="meta" style={{ margin: 0 }}><div><span>Nothing yet</span><b>—</b></div></div>
      ) : (
        <div className="card" style={{ borderRadius: 10 }}><table className="ledger">
          <thead><tr><th>Series</th><th>PT</th><th>YT</th><th>LP</th><th>Value</th><th>Accrued dividends</th><th>Redeems at maturity</th></tr></thead>
          <tbody>
            {held.map(({ r, s, st }) => (
              <tr key={r.id}>
                <td>{s.ticker} · {monthYear(s.maturity)}</td>
                <td>{f(r.pt, 3)}</td>
                <td className="y">{f(r.yt, 3)}</td>
                <td>{r.lp ? f(r.lp, 3) : '—'}</td>
                <td>${f((r.pt * st.ptPrice + r.yt * st.ytPrice) * st.usdPrice, 2)}</td>
                <td className="y">${f(ytClaim(r.yt, st.accrued) * st.usdPrice, 2)}</td>
                <td>{f(r.pt * principalPerPT(st.accrued), 3)} {s.ticker}</td>
              </tr>
            ))}
            <tr className="pf-total"><td>Total</td><td /><td /><td /><td>${f(totals.value, 2)}</td><td className="y">${f(totals.accrued, 2)}</td><td /></tr>
          </tbody>
        </table></div>
      )}
    </div>
  )
}
