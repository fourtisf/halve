import Link from 'next/link'
import { LINKS, X_HANDLE } from '@/lib/links'
import { XIcon } from './XIcon'

export function CTA() {
  return (
    <div className="wrap" style={{ paddingBottom: 104 }}>
      <div className="cta-box"><h2>Split your first share.</h2><p>Connect a wallet, pick an asset, get both halves in one transaction.</p><div className="cta-actions"><Link className="btn btn-white btn-lg" href="/app">Launch app</Link><a className="btn btn-line btn-lg" id="xcta" href={LINKS.x} target="_blank" rel="noopener noreferrer"><XIcon size={13} />Follow {X_HANDLE}</a></div></div>
    </div>
  )
}
