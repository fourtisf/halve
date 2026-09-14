import type { Metadata } from 'next'
import { AppShell } from '@/components/AppShell'
import { OracleTable } from '@/components/OracleTable'

export const metadata: Metadata = { title: 'Oracle — Halve' }

export default function OraclePage() {
  return (
    <AppShell active="oracle">
      <section><div className="wrap">
        <div className="sec-h"><div className="k">Dividend oracle</div><h2>The only feed that knows a split from a payout.</h2><p>Free for any protocol. One accountant per stock token, readable by any contract, no key. Wire <span className="mono">isSynced()</span> into your pause and you have a circuit breaker for every corporate action.</p></div>
        <OracleTable />
        <div className="grid" style={{ marginTop: 16 }}>
          <div className="cell"><h3>Read it from any contract</h3><div className="viz code"><div><b>isSynced()</b> → bool</div><div><b>dividendIndex()</b> → 1e18 = 1.0</div><div><b>splitFactor()</b> → 1e18 = 1.0</div><div><b>dividendIndexAt(ts)</b> → uint</div><div><b>pending()</b> → (exists, ts, old, new)</div></div></div>
          <div className="cell"><h3>Rules, not opinions</h3><p>Growth between 0 and 3% is a dividend. A clean small-integer ratio at least 20% from 1 is a split. The bands never overlap, and the contract rejects any tag outside them. A keeper can be late, never wrong.</p></div>
          <div className="cell"><h3>Everything else waits</h3><p>Special dividends, odd ratios, stacked actions: held for a guardian behind a two-day public timelock. The clock is on-chain, and merge stays open throughout.</p></div>
        </div>
      </div></section>
    </AppShell>
  )
}
