import Link from 'next/link'
import { LINKS, X_HANDLE, externalProps } from '@/lib/links'
import { XIcon } from './XIcon'
import { HalveLogo } from './Logo'

const ext = (href: string, label: string) => <a key={label} href={href} {...externalProps(href)}>{label}</a>

export function Footer() {
  return (
    <footer><div className="wrap">
      <div><div className="logo" style={{ marginBottom: 12 }}><HalveLogo /></div>Yield tokens are a claim on the issuer&apos;s declared dividend reinvestment, not on the underlying equity. Not investment advice. Not available where the underlying stock tokens are not available.</div>
      <div><b>Product</b><Link href="/app">App</Link><Link href="/lend">Lend</Link><Link href="/oracle">Oracle</Link><Link href="/token">$HALVE</Link></div>
      <div><b>Developers</b>{ext(LINKS.docs, 'Docs')}{ext(LINKS.contracts, 'Contracts')}{ext(LINKS.audit, 'Audit report')}{ext(LINKS.api, 'API')}</div>
      <div><b>Community</b><a href={LINKS.x} {...externalProps(LINKS.x)} className="xlink" id="xfooter"><XIcon size={12} />X · {X_HANDLE}</a>{ext(LINKS.telegram, 'Telegram')}{ext(LINKS.discord, 'Discord')}</div>
      <div><b>Legal</b><Link href="/legal/terms">Terms of Use</Link><Link href="/legal/privacy">Privacy</Link><Link href="/legal/risk">Risk disclosure</Link></div>
    </div></footer>
  )
}
