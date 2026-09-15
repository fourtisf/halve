'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useAccount, useSwitchChain } from 'wagmi'
import { useAccountModal } from '@rainbow-me/rainbowkit'
import { useIsMounted } from '@/hooks/useIsMounted'
import { useWalletModal } from '@/lib/walletModal'
import { shortAddr } from '@/lib/format'
import { CHAIN_ID } from '@/lib/wagmi'
import { LINKS, X_HANDLE, externalProps, isExternal } from '@/lib/links'
import { XIcon } from './XIcon'
import { HalveLogo } from './Logo'

const NAV = [
  { href: '/', label: 'Home' },
  { href: '/app', label: 'App' },
  { href: '/lend', label: 'Lend' },
  { href: '/oracle', label: 'Oracle' },
  { href: '/token', label: '$HALVE' },
] as const

/** Nav "Connect wallet" / address button. Opens the wallet picker, or RainbowKit's account modal once connected. */
export function WalletNavButton() {
  const mounted = useIsMounted()
  const { address, isConnected, chainId } = useAccount()
  const { openAccountModal } = useAccountModal()
  const { switchChain } = useSwitchChain()
  const { open } = useWalletModal()
  const connected = mounted && isConnected && !!address
  if (!connected) return <button className="btn btn-line wallet" id="wbtn" onClick={open}>Connect wallet</button>
  if (chainId !== CHAIN_ID) return <button className="btn btn-line wallet" id="wbtn" onClick={() => switchChain({ chainId: CHAIN_ID })}>Wrong network</button>
  return <button className="btn btn-line wallet" id="wbtn" onClick={() => openAccountModal?.()} aria-label={`Connected as ${address}`}><i />{shortAddr(address)}</button>
}

export function Nav() {
  const pathname = usePathname()
  const [menu, setMenu] = useState(false)
  useEffect(() => setMenu(false), [pathname])
  const links = (cls?: string, mobile = false) => (
    <>
      {NAV.map((l) => <Link key={l.href} href={l.href} className={pathname === l.href ? 'on' : cls}>{l.label}</Link>)}
      {isExternal(LINKS.docs) ? <a href={LINKS.docs} {...externalProps(LINKS.docs)}>Docs</a> : <Link href={LINKS.docs} className={pathname === LINKS.docs ? 'on' : cls}>Docs</Link>}
      {mobile && <a href={LINKS.x} target="_blank" rel="noopener noreferrer" className="xlink"><XIcon size={12} />{X_HANDLE} ↗</a>}
      {mobile && <Link href="/app" className="launch">Launch app →</Link>}
    </>
  )
  return (
    <nav>
      <div className="wrap">
        <Link className="logo" href="/"><HalveLogo /></Link>
        <div className="links" id="navlinks">{links()}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <a className="btn btn-line xbtn" id="xnav" href={LINKS.x} target="_blank" rel="noopener noreferrer" aria-label={`Halve on X (${X_HANDLE})`} title={X_HANDLE}><XIcon size={14} /></a>
          <WalletNavButton />
          <Link className="btn btn-white nav-launch" href="/app">Launch app</Link>
          <button className="menu-btn" id="menubtn" aria-label="Menu" aria-expanded={menu} aria-controls="mobilelinks" onClick={() => setMenu((m) => !m)}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
              {menu ? <><path d="M3 3l10 10" /><path d="M13 3L3 13" /></> : <><path d="M2 4h12" /><path d="M2 8h12" /><path d="M2 12h12" /></>}
            </svg>
          </button>
        </div>
      </div>
      <div className={'mobile-links' + (menu ? ' open' : '')} id="mobilelinks"><div className="wrap">{links(undefined, true)}</div></div>
    </nav>
  )
}
