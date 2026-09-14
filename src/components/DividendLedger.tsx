'use client'
import type { Ledger } from '@/lib/types'
import { dh, f, monthYear } from '@/lib/format'

export function DividendLedger({ ledger }: { ledger: Ledger }) {
  return (
    <div className="panel" style={{ marginTop: 16 }}>
      <h4>Dividend ledger <span>classified on-chain</span></h4>
      <div className="card" style={{ borderRadius: 10 }}><table className="ledger">
        <thead><tr><th>Date</th><th>Event</th><th>Ratio</th><th>Index after</th><th>Status</th></tr></thead>
        <tbody id="ledger">
          {ledger.rows.length === 0 ? (
            <tr><td colSpan={5} className="m">{ledger.isLoading ? 'Loading…' : 'No events yet this term'}</td></tr>
          ) : ledger.rows.map((r, i) => (
            <tr key={`${r.ts}-${i}`}>
              <td>{monthYear(r.ts)}</td>
              <td>{r.event}</td>
              <td>{f(r.ratio, 5)}</td>
              {r.indexAfter == null ? <td className="m">pending</td> : <td>{f(r.indexAfter, 6)}</td>}
              <td>{r.held ? <><span className="dot y" />Held · timelock {dh(r.timelockRemaining ?? 0)}</> : <><span className="dot g" />Classified</>}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </div>
  )
}
