import token from '@/content/token.json'
import { isAddress } from 'viem'
import { explorerAddress } from '@/lib/chain'
import { LINKS } from '@/lib/links'

/**
 * $HALVE page. Until `contractAddress` in src/content/token.json is set, the token does not exist: revenue and
 * burn figures read "—", and staking / voting are labelled as planned. Once it is set, the figures come from
 * token.json (phase 2: an indexer) and the copy drops the "planned" label.
 */
export function TokenPage() {
  const r = token.revenue30d
  const cell = { border: '1px solid var(--line)', borderRadius: 14 } as const
  const ca = isAddress(token.contractAddress) ? token.contractAddress : null
  const val = (v: string) => (ca ? v : '—')
  return (
    <section><div className="wrap">
      <div className="sec-h"><div className="k">$HALVE</div><h2>A token that only exists because the protocol earns.</h2>
        <p>{ca
          ? 'No emissions, no presale, no team allocation. Every function below is deployed, not promised.'
          : 'No emissions, no presale, no team allocation. Not deployed yet: the contract address is announced on X first, and every figure below starts at zero with the first series.'}</p>
        <div className="code" id="ca" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 18 }}>
          <b>$HALVE CA</b> →{' '}
          {ca ? <a href={explorerAddress(ca)} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--fg)' }}>{ca}</a> : <span className="y">coming soon</span>}
          <span className="m">·</span>
          <a href={LINKS.x} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--fg2)' }}>announced first on X</a>
        </div></div>
      <div className="tok">
        <div className="cell" style={cell}><h3>Revenue, last 30 days</h3><div className="rev"><span>Split fees (0.10%)</span><b>{val(r.splitFees)}</b></div><div className="rev"><span>Yield redemption fees (5%)</span><b>{val(r.yieldRedemptionFees)}</b></div><div className="rev"><span>Swap fees on protocol LP</span><b>{val(r.swapFees)}</b></div><div className="rev" style={{ borderTopColor: 'var(--line2)' }}><span style={{ color: 'var(--fg)' }}>Total</span><b>{val(r.total)}</b></div><div className="rev"><span>→ 50% buyback &amp; burn</span><b className="y">{val(r.buybackBurn)}</b></div><div className="rev"><span>→ 30% LP incentives</span><b>{val(r.lpIncentives)}</b></div><div className="rev"><span>→ 20% pool deepening</span><b>{val(r.poolDeepening)}</b></div>{!ca && <p className="m" style={{ fontSize: 12.5, marginTop: 10 }}>Revenue starts with the first live series; the split above is how it will be used.</p>}</div>
        <div style={{ display: 'grid', gap: 14 }}>
          <div className="cell" style={cell}><h3>Stake for fee discounts</h3><p>{ca ? '' : 'Planned: '}stakers pay 5 bps to split instead of 10, and get priority capacity when a series fills.</p></div>
          <div className="cell" style={cell}><h3>Vote on the next series</h3><p>{ca
            ? `Token holders choose which asset lists next and its cap. Current ballot: ${token.ballot.candidates.join(', ')}. Vote closes in ${token.ballot.closesIn}.`
            : `Planned: token holders choose which asset lists next and its cap. The first ballot opens once $HALVE is deployed; the shortlist is ${token.ballot.candidates.join(', ')}.`}</p></div>
          <div className="cell" style={cell}><h3>Supply</h3><div className="rev"><span>Total</span><b>{token.supply.total}</b></div><div className="rev"><span>Burned to date</span><b className="y">{ca ? token.supply.burned : '0'}</b></div><div className="rev"><span>Emissions</span><b>{token.supply.emissions}</b></div></div>
        </div>
      </div>
    </div></section>
  )
}
