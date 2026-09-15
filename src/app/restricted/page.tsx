import type { Metadata } from 'next'
import Link from 'next/link'
import { Prose } from '@/components/Prose'

export const metadata: Metadata = { title: 'Not available in your region', robots: { index: false } }

export default function RestrictedPage() {
  return (
    <Prose kicker="Restricted" title="Halve isn't available in your region." updated={null}>
      <p>The stock tokens Halve splits are only offered by their issuers in certain jurisdictions, and the app follows the same list. Based on your connection&apos;s location, the Split, Merge, Earn and Lend pages can&apos;t be used from here.</p>
      <p>The smart contracts are permissionless and the read-only pages stay open: the <Link href="/oracle">dividend oracle</Link>, the <Link href="/docs">documentation</Link> and the <Link href="/token">$HALVE</Link> page.</p>
      <p>If you believe this is a mistake (a VPN or a corporate proxy, for example), reconnect from your actual location. See the <Link href="/legal/terms">Terms of Use</Link> for the list of restricted jurisdictions.</p>
    </Prose>
  )
}
