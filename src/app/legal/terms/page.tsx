import type { Metadata } from 'next'
import Link from 'next/link'
import { Prose } from '@/components/Prose'

export const metadata: Metadata = { title: 'Terms of Use' }

const UPDATED = 'September 15, 2026'

export default function TermsPage() {
  return (
    <Prose kicker="Legal" title="Terms of Use" updated={UPDATED}>
      <p>These Terms of Use (the &quot;Terms&quot;) govern your access to and use of the website at halve.finance and its subdomains (the &quot;Site&quot;) and the web interface it provides to the Halve smart contracts deployed on Robinhood Chain (the &quot;Interface&quot;). By using the Site or the Interface you agree to these Terms. If you do not agree, do not use them.</p>

      <h3 id="what">1. What Halve is, and what it is not</h3>
      <p>Halve is a set of open, non-custodial smart contracts (the &quot;Protocol&quot;) that split a tokenized stock or ETF into a principal token and a yield token and merge them back. The Site and the Interface are one way of reading from and sending transactions to those contracts. The Protocol is autonomous: nobody, including the people who maintain the Site, holds your tokens, can move them, can reverse a transaction, or can change the terms of a series once it is deployed. The Site is provided by the maintainers of the Halve project (&quot;we&quot;, &quot;us&quot;); it is not a broker, exchange, custodian, investment adviser or bank.</p>

      <h3 id="eligibility">2. Eligibility and restricted jurisdictions</h3>
      <p>You may use the Interface only if you are at least 18 years old, are legally permitted to hold the tokens involved under the laws that apply to you, and are not a person or entity subject to sanctions. The stock tokens the Protocol splits are offered by their issuers only in certain jurisdictions, and the Interface follows the same restrictions. You may not use the Interface if you are located in, incorporated in, or a resident of the <strong>United States of America</strong>, or any other jurisdiction where the underlying stock tokens are not lawfully available or where use of the Interface would be unlawful (together, the &quot;Restricted Jurisdictions&quot;). We may block access from Restricted Jurisdictions and you agree not to use a VPN, proxy or other means to circumvent such a block. Connecting a wallet is your representation that you are eligible.</p>

      <h3 id="risk">3. Risk</h3>
      <p>Using the Protocol involves substantial risk, including the total loss of the tokens you deposit. You should read the <Link href="/legal/risk">Risk Disclosure</Link> before using the Interface; it forms part of these Terms. Nothing on the Site is investment, legal, tax or financial advice, and no figure shown (prices, yields, APY, accrued dividends, valuations) is a promise, forecast or guarantee.</p>

      <h3 id="wallet">4. Your wallet and your transactions</h3>
      <p>You interact with the Protocol through a wallet you control. You are solely responsible for the security of that wallet, its keys and seed phrase, for reviewing every transaction before you sign it, and for paying network fees. We never ask for your keys and cannot recover them. Transactions on Robinhood Chain are irreversible once confirmed.</p>

      <h3 id="fees">5. Fees</h3>
      <p>The Protocol takes a 0.10% fee on the share when it is split and a 5% fee on the dividends when a yield token is redeemed after maturity. Merging is free. Fees are enforced by the contracts and are shown in the Interface before you sign. Third-party services you may use alongside the Interface (wallets, decentralised exchanges, lending markets) charge their own fees under their own terms.</p>

      <h3 id="third-parties">6. Third-party services and content</h3>
      <p>The Interface links to and reads from services we do not control, including the Robinhood Chain RPC, block explorers, Chainlink price feeds, Uniswap pools, Morpho markets and wallet software. We are not responsible for their availability, accuracy or conduct. The stock tokens themselves are issued by third parties under their own terms; Halve has no relationship with the issuers and no control over dividends, splits, delistings or redemptions of the underlying tokens.</p>

      <h3 id="prohibited">7. Prohibited use</h3>
      <p>You agree not to use the Site or Interface to violate any law or sanctions programme, to launder money or finance terrorism, to interfere with the Site or its infrastructure, to scrape it at a rate that degrades service for others, to misrepresent your identity or location, or to exploit a bug in the Protocol to the detriment of other users. If you find a vulnerability, report it responsibly (see the <Link href="/docs#security">security section of the docs</Link>).</p>

      <h3 id="ip">8. Intellectual property and open source</h3>
      <p>The Protocol&apos;s smart contracts are published under the MIT licence. The Halve name, logo and the Site&apos;s design are ours; you may not use them to suggest an affiliation that does not exist.</p>

      <h3 id="warranty">9. No warranty</h3>
      <p>THE SITE, THE INTERFACE AND THE PROTOCOL ARE PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, ACCURACY OR UNINTERRUPTED OPERATION. The smart contracts have not been audited by a third party at the date above; see the Risk Disclosure.</p>

      <h3 id="liability">10. Limitation of liability</h3>
      <p>TO THE FULLEST EXTENT PERMITTED BY LAW, WE AND OUR CONTRIBUTORS WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL OR EXEMPLARY DAMAGES, OR FOR ANY LOSS OF TOKENS, PROFITS, DATA OR GOODWILL, ARISING FROM YOUR USE OF THE SITE, THE INTERFACE OR THE PROTOCOL, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. Some jurisdictions do not allow certain exclusions; in that case our liability is limited to the smallest amount permitted.</p>

      <h3 id="changes">11. Changes, suspension and termination</h3>
      <p>We may change the Site and the Interface, restrict access to them, or stop operating them at any time. The Protocol keeps running regardless: merge and redemption are functions of the contracts and remain available through any other interface or directly on-chain. We may update these Terms by posting a new version with a new date; continued use after that date is acceptance.</p>

      <h3 id="law">12. Governing law and disputes</h3>
      <p>These Terms are governed by the law of the jurisdiction in which the maintainers of the Site are established, without regard to conflict-of-law rules, and any dispute will be resolved in its courts, unless mandatory consumer law where you live provides otherwise. Any claim must be brought within one year of the event giving rise to it.</p>

      <h3 id="contact">13. Contact</h3>
      <p>Questions about these Terms: reach us on <a href="https://x.com/Halvefinance" target="_blank" rel="noopener noreferrer">X (@Halvefinance)</a>. See also the <Link href="/legal/privacy">Privacy Notice</Link>.</p>
    </Prose>
  )
}
