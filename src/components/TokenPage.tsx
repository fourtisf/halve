import token from '@/content/token.json'
import { isAddress } from 'viem'
import { explorerAddress } from '@/lib/chain'
import { LINKS } from '@/lib/links'

/** $HALVE page. Figures come from src/content/token.json (phase 2: indexer). Copy is the prototype's. */
export function TokenPage() {
  const r = token.revenue30d
  const cell = { border: '1px solid var(--line)', borderRadius: 14 } as const
  const ca = isAddress(token.contractAddress) ? token.contractAddress : null
  return (
    <section><div className="wrap">
      <div className="sec-h"><div className="k">$HALVE</div><h2>A token that only exists because the protocol earns.</h2><p>No emissions, no presale, no team allocation. Every function below is deployed, not promised.</p>
        <div className="code" id="ca" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 18 }}>
          <b>$HALVE CA</b> →{' '}
          {ca ? <a href={explorerAddress(ca)} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--fg)' }}>{ca}</a> : <span className="y">coming soon</span>}
          <span className="m">·</span>
          <a href={LINKS.x} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--fg2)' }}>announced first on X</a>
        </div></div>
      <div className="tok">
        <div className="cell" style={cell}><h3>Revenue, last 30 days</h3><div className="rev"><span>Split fees (0.10%)</span><b>{r.splitFees}</b></div><div className="rev"><span>Yield redemption fees (5%)</span><b>{r.yieldRedemptionFees}</b></div><div className="rev"><span>Swap fees on protocol LP</span><b>{r.swapFees}</b></div><div className="rev" style={{ borderTopColor: 'var(--line2)' }}><span style={{ color: 'var(--fg)' }}>Total</span><b>{r.total}</b></div><div className="rev"><span>→ 50% buyback &amp; burn</span><b className="y">{r.buybackBurn}</b></div><div className="rev"><span>→ 30% LP incentives</span><b>{r.lpIncentives}</b></div><div className="rev"><span>→ 20% pool deepening</span><b>{r.poolDeepening}</b></div></div>
        <div style={{ display: 'grid', gap: 14 }}>
          <div className="cell" style={cell}><h3>Stake for fee discounts</h3><p>Stakers pay 5 bps to split instead of 10, and get priority capacity when a series fills. Live in the router, not a roadmap.</p></div>
          <div className="cell" style={cell}><h3>Vote on the next series</h3><p>Token holders choose which asset lists next and its cap. Current ballot: {token.ballot.candidates.join(', ')}. Vote closes in {token.ballot.closesIn}.</p></div>
          <div className="cell" style={cell}><h3>Supply</h3><div className="rev"><span>Total</span><b>{token.supply.total}</b></div><div className="rev"><span>Burned to date</span><b className="y">{token.supply.burned}</b></div><div className="rev"><span>Emissions</span><b>{token.supply.emissions}</b></div></div>
        </div>
      </div>
    </div></section>
  )
}
