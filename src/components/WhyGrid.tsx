export function WhyGrid() {
  return (
    <section style={{ paddingTop: 0 }}><div className="wrap">
      <div className="sec-h"><div className="k">03 — Why it holds</div><h2>Built so the numbers can&apos;t lie.</h2></div>
      <div className="grid">
        <div className="cell"><h3>Always fully backed</h3><p>The vault holds exactly the shares deposited. PT and YT redeem to precisely that, so there is nothing to run on.</p></div>
        <div className="cell"><h3>Free merge pins the price</h3><p>If PT + YT ever trades above one share, split and sell. Below, buy both and merge. Arbitrage keeps it at par without permission.</p></div>
        <div className="cell"><h3>Dividends classified on-chain</h3><p>An oracle tells a dividend from a stock split by rule. Anything ambiguous waits two days in public, and merge stays open the whole time.</p></div>
        <div className="cell"><h3>Multi-issuer</h3><p>Robinhood, Backed and Dinari tokens run on the same vault design. No single issuer can take the protocol down.</p></div>
        <div className="cell"><h3>Audited, verified, open</h3><p>Pashov Audit Group report published. Every contract verified on Blockscout. No admin key over user funds.</p></div>
        <div className="cell"><h3>Liquidity that deepens itself</h3><p>Protocol revenue is recycled into the PT and YT pools plus LP incentives, so spreads tighten as usage grows.</p></div>
      </div>
    </div></section>
  )
}
