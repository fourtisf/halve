export function FAQ() {
  return (
    <section id="faq" style={{ paddingTop: 0 }}><div className="wrap">
      <div className="sec-h"><div className="k">05 — FAQ</div><h2>Questions, answered plainly.</h2></div>
      <div className="faq">
        <details open><summary>What do I actually get?</summary><p>Exactly your deposit, in two pieces. Hold both and nothing changes. Sell the yield token and you&apos;ve locked a fixed return on the share. Sell the principal and you own only the dividend stream. Merge at any time to get the share back, free.</p></details>
        <details><summary>Can I lose more than I put in?</summary><p>No. There is no leverage or liquidation. The worst case for a yield token is that the asset pays fewer dividends than the market expected. The principal token always redeems the full share at maturity.</p></details>
        <details><summary>How do I claim my dividend?</summary><p>You don&apos;t — on these chains the dividend is reinvested into the token automatically. Halve makes that growth visible and tradable. Any site offering a &quot;claim&quot; button for stock-token dividends is a scam.</p></details>
        <details><summary>What if the issuer changes something?</summary><p>Yield tokens are a claim on the issuer&apos;s declared reinvestment, not on the underlying equity. If an issuer pauses or geo-blocks, merge stays open and you get the share back. Series are spread across three issuers to limit this risk.</p></details>
      </div>
    </div></section>
  )
}
