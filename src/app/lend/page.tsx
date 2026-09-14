import type { Metadata } from 'next'
import { AppShell } from '@/components/AppShell'
import { LendMarkets } from '@/components/LendMarkets'

export const metadata: Metadata = { title: 'Lend — Halve' }

export default function LendPage() {
  return (
    <AppShell active="lend">
      <section><div className="wrap">
        <div className="sec-h"><div className="k">Lend</div><h2>Borrow against the principal.</h2><p>Principal tokens are a stock claim with the dividend removed — the cleanest collateral on this chain. Markets run on Morpho with the Halve oracle wired into the pause.</p></div>
        <LendMarkets />
        <div className="note" style={{ marginTop: 14 }}>Borrowing is available to everyone. Markets pause automatically while the oracle reports an unclassified corporate action, so no liquidation happens inside a dividend or split window.</div>
      </div></section>
    </AppShell>
  )
}
