'use client'
import { useRouter } from 'next/navigation'
import { useMemo } from 'react'
import { useSeries } from '@/hooks/useSeries'
import { useAllSeriesStats } from '@/hooks/useSeriesStats'
import { f, monthYear } from '@/lib/format'

export function MarketsTable() {
  const router = useRouter()
  const series = useSeries()
  const stats = useAllSeriesStats()
  const rows = useMemo(
    () => series.map((s, i) => ({ s, st: stats[i], i })).sort((a, b) => b.st.fixedApy - a.st.fixedApy),
    [series, stats],
  )
  return (
    <section id="markets"><div className="wrap">
      <div className="sec-h"><div className="k">01 — Markets</div><h2>Start with assets that pay.</h2><p>Every series is a stock or ETF and a maturity date. Sorted by what you can actually earn.</p></div>
      <div className="card"><table>
        <thead><tr><th>Asset</th><th>Issuer</th><th>Dividend yield</th><th>Fixed APY · PT</th><th>YT price</th><th>Maturity</th><th>Capacity</th><th></th></tr></thead>
        <tbody id="mkt">
          {rows.map(({ s, st, i }) => {
            const cap = Math.round(st.capacityUsed * 100)
            return (
              <tr key={s.id} onClick={() => router.push(`/app?s=${i}`)}>
                <td><div className="tk"><i>{s.ticker.slice(0, 2)}</i><div><b>{s.ticker}</b><span>{s.name}</span></div></div></td>
                <td><span className="pill i">{s.issuer}</span></td>
                <td className="mono">{st.ready ? f(st.divYield * 100, 1) + '%' : '—'}</td>
                <td className="mono g">{st.ready ? f(st.fixedApy * 100, 1) + '%' : '—'}</td>
                <td className="mono"><span className="pill y">y{s.ticker}</span> {st.ready ? f(st.ytPrice) : '—'}</td>
                <td>{monthYear(s.maturity)}</td>
                <td><span className="bar"><i style={{ width: `${cap}%` }} /></span><span className="mono m">{cap}%</span></td>
                <td style={{ textAlign: 'right' }}><span className="btn btn-line btn-sm">Split</span></td>
              </tr>
            )
          })}
        </tbody>
      </table></div>
      <div className="note" style={{ marginTop: 12 }}>Yields are read from pool prices and the issuer&apos;s declared distribution schedule. Past distributions do not guarantee future ones.</div>
    </div></section>
  )
}
