export function HowGrid() {
  return (
    <section id="how" style={{ paddingTop: 0 }}><div className="wrap">
      <div className="sec-h"><div className="k">02 — How it works</div><h2>You get exactly what you deposit, in two pieces.</h2></div>
      <div className="grid">
        <div className="cell"><div className="k">Step 1</div><h3>Deposit one share</h3><p>Any supported stock token. A 0.10% fee is taken once, in the share. That is the only fee on the way in.</p></div>
        <div className="cell"><div className="k">Step 2</div><h3>Receive both halves</h3><p>A principal token, PT, is the share with the dividends removed. A yield token, YT, is the dividends with the share removed. Keep both, or sell the one you don&apos;t want.</p><div className="viz code"><b>1 share</b> → <b>1 PT</b> + <b className="y">1 YT</b></div></div>
        <div className="cell"><div className="k">Step 3</div><h3>Exit whenever you like</h3><p>Merge one PT and one YT back into the share, free, at any time. Or hold to maturity and redeem. Neither depends on pool liquidity.</p></div>
      </div>
    </div></section>
  )
}
