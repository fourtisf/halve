import type { Metadata } from 'next'
import Link from 'next/link'
import { Prose } from '@/components/Prose'

export const metadata: Metadata = { title: 'Privacy Notice' }

const UPDATED = 'September 15, 2026'

export default function PrivacyPage() {
  return (
    <Prose kicker="Legal" title="Privacy Notice" updated={UPDATED}>
      <p>This notice explains what the halve.finance website (the &quot;Site&quot;) collects, why, and what it does not. Short version: the Site has no accounts, sets no tracking cookies, and never sees your private keys. The blockchain is public, and what you do on it is visible to everyone, including us.</p>

      <h3 id="collect">1. What we collect</h3>
      <ul>
        <li><strong>Server logs.</strong> Like every website, our server records the IP address, the page requested, the time, and the browser&apos;s user agent for each request. Logs are used to keep the Site running and to investigate abuse, and are rotated after a short period.</li>
        <li><strong>Approximate location.</strong> When a network provider in front of the Site supplies a country code with the request, we use it once to decide whether the transactional pages are available in your region (see the <Link href="/legal/terms">Terms of Use</Link>). We do not store it.</li>
        <li><strong>Your wallet address.</strong> When you connect a wallet, the Site reads your public address in your browser to show your balances and to build the transactions you sign. The address is sent to the blockchain RPC endpoint with those reads; it is not stored on our servers.</li>
        <li><strong>Error reports.</strong> If the Site crashes in your browser, an anonymous report (the error message, the page, the browser) may be sent to our error endpoint so we can fix it. It does not include your wallet address.</li>
        <li><strong>Local storage.</strong> The Site keeps small preferences in your browser (for example the last wallet you used and, in demo mode, a demo position). They never leave your device and you can clear them in your browser settings.</li>
      </ul>

      <h3 id="not">2. What we do not collect</h3>
      <p>No names, emails, accounts, passwords, private keys or seed phrases. No advertising or cross-site tracking cookies. No fingerprinting. We do not sell or rent data to anyone.</p>

      <h3 id="third">3. Third parties that see your traffic</h3>
      <p>Your browser talks directly to a few services when you use the Site: the <strong>Robinhood Chain RPC</strong> (to read balances and send transactions), a <strong>block explorer</strong> when you follow a transaction link, <strong>Google Fonts</strong> for typography, and your <strong>wallet</strong> software and, if you use it, the WalletConnect relay. Each has its own privacy policy. When the Site is hosted on Vercel, Vercel Analytics may collect anonymous page-view statistics.</p>

      <h3 id="blockchain">4. The blockchain is public</h3>
      <p>Every split, merge and redemption you make is recorded permanently on Robinhood Chain together with your address, and can be read by anyone, including us. Nothing in this notice can change that.</p>

      <h3 id="rights">5. Your rights</h3>
      <p>Depending on where you live you may have the right to access, correct or delete personal data we hold, or to object to its processing. Because we hold almost none, in practice this means server logs, which are deleted on rotation. To exercise a right, contact us on <a href="https://x.com/Halvefinance" target="_blank" rel="noopener noreferrer">X (@Halvefinance)</a>.</p>

      <h3 id="changes">6. Changes</h3>
      <p>We will post any change to this notice here with a new date.</p>
    </Prose>
  )
}
