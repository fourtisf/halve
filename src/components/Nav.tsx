'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAccount, useSwitchChain } from 'wagmi'
import { useAccountModal } from '@rainbow-me/rainbowkit'
import { useIsMounted } from '@/hooks/useIsMounted'
import { useWalletModal } from '@/lib/walletModal'
import { shortAddr } from '@/lib/format'
import { CHAIN_ID } from '@/lib/wagmi'

const LINKS = [
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
  return <button className="btn btn-line wallet" id="wbtn" onClick={() => openAccountModal?.()}><i />{shortAddr(address)}</button>
}

export function Nav() {
  const pathname = usePathname()
  return (
    <nav><div className="wrap">
      <Link className="logo" href="/"><i />Halve</Link>
      <div className="links" id="navlinks">
        {LINKS.map((l) => <Link key={l.href} href={l.href} className={pathname === l.href ? 'on' : undefined}>{l.label}</Link>)}
        <a href="#">Docs</a>
      </div>
      <div style={{ display: 'flex', gap: 8 }}><WalletNavButton /><Link className="btn btn-white" href="/app">Launch app</Link></div>
    </div></nav>
  )
}
