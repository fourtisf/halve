'use client'
import { useMemo } from 'react'
import { useAllSeriesStats } from '@/hooks/useSeriesStats'
import { useAllPositions } from '@/hooks/useAllPositions'
import { useActivity } from '@/hooks/useActivity'
import { summarizePnl } from '@/lib/activity'
import { explorerTx } from '@/lib/chain'
import { f } from '@/lib/format'
import { Skel } from './Skeleton'

const when = (ts: number) => (ts ? new Date(ts * 1000).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—')
const signed = (n: number, d: number) => (n > 0 ? '+' : n < 0 ? '−' : '') + f(Math.abs(n), d)

/** Portfolio → Activity: the wallet's splits / merges / redemptions and a PnL per series (in stock and USD). */
export function Activity() {
  const { stats } = useAllSeriesStats()
  const { rows: positions, connected } = useAllPositions()
  const act = useActivity()
  const pnl = useMemo(
    () => summarizePnl(act.rows, positions.map((p, i) => ({ id: p.id, ticker: p.ticker, pt: p.pt, yt: p.yt, ptPrice: stats[i]?.ptPrice ?? 0, ytPrice: stats[i]?.ytPrice ?? 0, usdPrice: stats[i]?.usdPrice ?? 0 }))),
    [act.rows, positions, stats],
  )
  if (!connected) return null
  const t = pnl.total
  return (
    <div className="panel" id="activity" style={{ marginTop: 16 }}>
      <h4>Activity <span>{act.isLoading ? 'loading' : `${act.rows.length} transactions${act.isMock ? ' · demo' : ''}`}</span></h4>
      <div className="pnl" id="pnl">
        <div><small>Deposited</small><b>{f(t.deposited, 4)}</b></div>
        <div><small>Withdrawn</small><b>{f(t.withdrawn, 4)}</b></div>
        <div><small>Held now (at pool prices)</small><b>{f(t.holdings, 4)}</b></div>
        <div><small>PnL</small><b className={t.pnl > 0 ? 'g' : t.pnl < 0 ? 'r' : undefined}>{signed(t.pnl, 4)} <span className="m" style={{ fontSize: 12 }}>· {signed(t.pnlUsd, 2).replace(/^([+−]?)/, '$1$')}</span></b></div>
      </div>
      {act.isLoading ? (
        <div className="meta" style={{ margin: 0 }}><div><span>Reading vault events</span><b><Skel w={60} /></b></div></div>
      ) : act.rows.length === 0 ? (
        <div className="meta" style={{ margin: 0 }}><div><span>No transactions yet</span><b>—</b></div></div>
      ) : (
        <div className="card" style={{ borderRadius: 10 }}><table className="ledger act">
          <thead><tr><th>When</th><th>Series</th><th>Action</th><th>Stock</th><th>PT / YT</th><th>Tx</th></tr></thead>
          <tbody>
            {act.rows.slice(0, 50).map((r, i) => (
              <tr key={`${r.txHash ?? r.ts}-${i}`}>
                <td>{when(r.ts)}</td>
                <td>{r.ticker}</td>
                <td>{r.action}</td>
                <td className={r.action === 'Split' ? undefined : 'g'}>{r.action === 'Split' ? '−' : '+'}{f(r.amount, 4)}</td>
                <td className={r.action === 'Split' ? 'g' : undefined}>{r.action === 'Split' ? '+' : '−'}{f(r.base, 4)}</td>
                <td>{r.txHash ? <a href={explorerTx(r.txHash)} target="_blank" rel="noopener noreferrer">↗</a> : <span className="m">demo</span>}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
      <div className="note">PnL = withdrawn + current holdings at pool prices − deposited, in the stock token. Includes the 0.10 % split fee; excludes gas.</div>
    </div>
  )
}
