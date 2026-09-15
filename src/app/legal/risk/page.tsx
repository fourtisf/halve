import type { Metadata } from 'next'
import Link from 'next/link'
import { Prose } from '@/components/Prose'

export const metadata: Metadata = { title: 'Risk Disclosure' }

const UPDATED = 'September 15, 2026'

export default function RiskPage() {
  return (
    <Prose kicker="Legal" title="Risk Disclosure" updated={UPDATED}>
      <p>Read this before you split, merge, trade or lend anything on Halve. It is part of the <Link href="/legal/terms">Terms of Use</Link>. It is not exhaustive: it lists the risks we know about, in plain language.</p>

      <h3 id="contracts">1. Smart-contract risk</h3>
      <p>Halve is code. The contracts are open source and covered by a test suite, but <strong>they have not yet been audited by an independent third party</strong>. A bug could freeze or lose every token deposited in a vault. Only deposit what you can afford to lose entirely.</p>

      <h3 id="underlying">2. The underlying stock tokens</h3>
      <p>A yield token is a claim on the dividend reinvestment that a token issuer declares through its on-chain multiplier. It is <strong>not</strong> a claim on the underlying company or on any real share. If an issuer stops paying, changes its multiplier rules, pauses transfers, delists or redeems a token, the corresponding Halve series is affected and may be worth nothing. Halve has no relationship with the issuers and no way to influence them.</p>

      <h3 id="price">3. Market and liquidity risk</h3>
      <p>Principal and yield tokens trade on decentralised exchanges. Their prices can move sharply, liquidity can be thin or vanish, and you may not be able to sell at the price shown on the Site or at all. The fixed yield shown for a principal token is only realised if you hold it to maturity and the underlying token is still redeemable then. Merging back into the stock token is always available through the vault, whatever the pools look like.</p>

      <h3 id="oracle">4. Corporate actions and the dividend oracle</h3>
      <p>The accountant contract classifies changes in a token&apos;s multiplier by rule: small growth is a dividend, a clean ratio is a split, anything else is held for a guardian behind a public two-day timelock. A misclassification, a delayed keeper, or a guardian decision you disagree with changes how value is shared between principal and yield holders. While a change is held, splitting and settlement pause; merging does not.</p>

      <h3 id="guardian">5. Guardian and operator risk</h3>
      <p>The guardian can only resolve a held change after the timelock, and only into one of the allowed kinds. The vault owner can only change the deposit cap and the treasury address. Neither can move user funds, pause merges or upgrade the contracts. They can, however, act slowly, wrongly or not at all.</p>

      <h3 id="settlement">6. Maturity and settlement</h3>
      <p>At maturity a series is settled at the accountant&apos;s current index. Redemptions after that pay principal holders the share and yield holders the accrued dividends less the 5% fee. If the accountant is holding an unresolved change at maturity, settlement waits for the guardian.</p>

      <h3 id="lend">7. Lending and leverage</h3>
      <p>Using principal or yield tokens as collateral on a lending market adds liquidation risk on top of everything above. Yield tokens are leveraged exposure to dividends by construction; small changes in expected payouts move their price a lot.</p>

      <h3 id="chain">8. Network, wallet and interface risk</h3>
      <p>Robinhood Chain, its RPC endpoints, the price feeds and the block explorer can go down, be congested or return wrong data. Your wallet can be compromised. This website can be unavailable or display incorrect numbers. The contracts do not depend on this website: read the <Link href="/docs">documentation</Link> so you can merge or redeem directly if you ever need to.</p>

      <h3 id="legal">9. Legal and tax</h3>
      <p>Tokenized stocks and yield-splitting are new and their regulatory treatment varies by country and is changing. Using them may be restricted or taxable where you live. It is your responsibility to know the rules that apply to you.</p>

      <h3 id="token">10. $HALVE</h3>
      <p>$HALVE is a utility and governance token. It has no claim on any assets held by the Protocol, no guaranteed value and no guaranteed liquidity. Any buyback described on the Site is a function of protocol revenue, which can be zero.</p>
    </Prose>
  )
}
