import Link from 'next/link'

export function Footer() {
  return (
    <footer><div className="wrap">
      <div><div className="logo" style={{ marginBottom: 12 }}><i />Halve</div>Yield tokens are a claim on the issuer&apos;s declared dividend reinvestment, not on the underlying equity. Not investment advice. Not available where the underlying stock tokens are not available.</div>
      <div><b>Product</b><Link href="/app">App</Link><Link href="/lend">Lend</Link><Link href="/oracle">Oracle</Link><Link href="/token">$HALVE</Link></div>
      <div><b>Developers</b><a href="#">Docs</a><a href="#">Contracts</a><a href="#">Audit report</a><a href="#">API</a></div>
      <div><b>Community</b><a href="#">X</a><a href="#">Telegram</a><a href="#">Discord</a></div>
    </div></footer>
  )
}
