'use client'
import { useSeries } from '@/hooks/useSeries'
import { useAllSeriesStats } from '@/hooks/useSeriesStats'
import { f } from '@/lib/format'

/** Accountant status per stock token: isSynced(), dividendIndex(), splitFactor(), schedule, checkpoints. */
export function OracleTable() {
  const series = useSeries()
  const stats = useAllSeriesStats()
  return (
    <div className="card"><table className="orc">
      <thead><tr><th>Token</th><th>Issuer</th><th>Status</th><th>Dividend index</th><th>Split factor</th><th>Next scheduled</th><th>Last classified</th></tr></thead>
      <tbody id="orc">
        {series.map((s, i) => {
          const st = stats[i]
          return (
            <tr key={s.id}>
              <td>{s.ticker}</td>
              <td className="m">{s.issuer}</td>
              <td>{st.isSynced ? <><span className="dot g" />Synced</> : <><span className="dot y" />Held · timelock</>}</td>
              <td className="mono">{st.ready ? f(st.dividendIndex, 6) : '—'}</td>
              <td className="mono">{st.ready ? f(st.splitFactor, 6) : '—'}</td>
              <td className="sched">{s.schedule ?? '—'}</td>
              <td className="m">{st.events} events</td>
            </tr>
          )
        })}
      </tbody>
    </table></div>
  )
}
