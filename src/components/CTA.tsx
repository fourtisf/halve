import Link from 'next/link'

export function CTA() {
  return (
    <div className="wrap" style={{ paddingBottom: 104 }}>
      <div className="cta-box"><h2>Split your first share.</h2><p>Connect a wallet, pick an asset, get both halves in one transaction.</p><Link className="btn btn-white btn-lg" href="/app">Launch app</Link></div>
    </div>
  )
}
