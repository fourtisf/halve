/** $HALVE page. Revenue / supply figures are protocol-level aggregates (phase 2: indexer). */
export function TokenPage() {
  return (
    <section><div className="wrap">
      <div className="sec-h"><div className="k">$HALVE</div><h2>A token that only exists because the protocol earns.</h2><p>No emissions, no presale, no team allocation. Every function below is deployed, not promised.</p></div>
      <div className="tok">
        <div className="cell" style={{ border: '1px solid var(--line)', borderRadius: 14 }}><h3>Revenue, last 30 days</h3><div className="rev"><span>Split fees (0.10%)</span><b>$14,220</b></div><div className="rev"><span>Yield redemption fees (5%)</span><b>$20,600</b></div><div className="rev"><span>Swap fees on protocol LP</span><b>$9,140</b></div><div className="rev" style={{ borderTopColor: 'var(--line2)' }}><span style={{ color: 'var(--fg)' }}>Total</span><b>$43,960</b></div><div className="rev"><span>→ 50% buyback &amp; burn</span><b className="y">$21,980</b></div><div className="rev"><span>→ 30% LP incentives</span><b>$13,188</b></div><div className="rev"><span>→ 20% pool deepening</span><b>$8,792</b></div></div>
        <div style={{ display: 'grid', gap: 14 }}>
          <div className="cell" style={{ border: '1px solid var(--line)', borderRadius: 14 }}><h3>Stake for fee discounts</h3><p>Stakers pay 5 bps to split instead of 10, and get priority capacity when a series fills. Live in the router, not a roadmap.</p></div>
          <div className="cell" style={{ border: '1px solid var(--line)', borderRadius: 14 }}><h3>Vote on the next series</h3><p>Token holders choose which asset lists next and its cap. Current ballot: O, VYM, BIL. Vote closes in 4 days.</p></div>
          <div className="cell" style={{ border: '1px solid var(--line)', borderRadius: 14 }}><h3>Supply</h3><div className="rev"><span>Total</span><b>1,000,000,000</b></div><div className="rev"><span>Burned to date</span><b className="y">12,418,300</b></div><div className="rev"><span>Emissions</span><b>0</b></div></div>
        </div>
      </div>
    </div></section>
  )
}
