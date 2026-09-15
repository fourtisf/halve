'use client'
import { useEffect, useRef, useState } from 'react'
import { WalletButton } from '@rainbow-me/rainbowkit'
import { useAccount, useConnect, useConnectors } from 'wagmi'
import { useWalletModal } from '@/lib/walletModal'
import { shortError, useToast } from '@/lib/toast'
import { CHAIN_ID, DEMO_CONNECTOR_ID } from '@/lib/wagmi'
import { HAS_WALLETCONNECT, MOCK } from '@/lib/env'
import { HalveMark } from './Logo'

/** RainbowKit wallet ids (matched case-insensitively by WalletButton), in display order. */
const WALLETS: { id: string; label: string }[] = [
  { id: 'metaMask', label: 'MetaMask' },
  { id: 'rabby', label: 'Rabby' },
  { id: 'coinbase', label: 'Coinbase Wallet' },
  { id: 'trust', label: 'Trust Wallet' },
  { id: 'okx', label: 'OKX Wallet' },
  { id: 'phantom', label: 'Phantom' },
  { id: 'rainbow', label: 'Rainbow' },
  { id: 'binance', label: 'Binance Wallet' },
  ...(HAS_WALLETCONNECT ? [{ id: 'walletConnect', label: 'WalletConnect' }] : []),
]

const FOCUSABLE = 'button:not([disabled]), a[href], input, [tabindex]:not([tabindex="-1"])'

type IconSrc = string | (() => Promise<string>) | undefined

/** RainbowKit ships wallet icons as data URLs, sometimes behind an async loader. */
function WalletIcon({ src, bg }: { src: IconSrc; bg?: string }) {
  const [url, setUrl] = useState<string | null>(typeof src === 'string' ? src : null)
  useEffect(() => {
    let alive = true
    if (typeof src === 'function') src().then((u) => { if (alive) setUrl(u) }).catch(() => {})
    else setUrl(src ?? null)
    return () => { alive = false }
  }, [src])
  return (
    <span className="wicon" style={{ background: bg ?? 'var(--line2)' }} aria-hidden="true">
      {url ? <img src={url} alt="" width={26} height={26} /> : null}
    </span>
  )
}

/** Prototype-styled wallet picker; each option connects through RainbowKit's connector for that wallet. */
export function WalletModal() {
  const { isOpen, close } = useWalletModal()
  const { toast } = useToast()
  const { isConnected } = useAccount()
  const connectors = useConnectors()
  const { connectAsync } = useConnect()
  const [pending, setPending] = useState<string | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const restore = useRef<HTMLElement | null>(null)
  const demo = MOCK ? connectors.find((c) => c.id === DEMO_CONNECTOR_ID) : undefined

  useEffect(() => {
    if (!isConnected || !isOpen) return
    close()
    if (pending) toast(`Connected with ${pending}`)
    setPending(null)
  }, [isConnected, isOpen, pending, close, toast])

  // Generic browser wallet: shown only when something is injected (decided after hydration).
  const [hasInjected, setHasInjected] = useState(false)
  useEffect(() => { setHasInjected(typeof window !== 'undefined' && !!(window as { ethereum?: unknown }).ethereum) }, [isOpen])
  const injected = connectors.find((c) => c.id === 'injected')
  const injectedDetails = (injected as unknown as { rkDetails?: { iconUrl?: IconSrc; iconBackground?: string } } | undefined)?.rkDetails

  // Focus trap: focus the first option on open, keep Tab inside the box, restore focus on close.
  useEffect(() => {
    if (!isOpen) return
    restore.current = document.activeElement as HTMLElement | null
    const first = box.current?.querySelector<HTMLElement>(FOCUSABLE)
    first?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return close()
      if (e.key !== 'Tab' || !box.current) return
      const items = Array.from(box.current.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (items.length === 0) return
      const [a, z] = [items[0], items[items.length - 1]]
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus() }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus() }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      restore.current?.focus?.()
    }
  }, [isOpen, close])

  return (
    <div className={'modal' + (isOpen ? ' open' : '')} id="wmodal" onClick={(e) => { if (e.target === e.currentTarget) close() }} role="dialog" aria-modal="true" aria-label="Connect a wallet" aria-hidden={!isOpen}>
      <div className="box" ref={box}>
        <h3>Connect a wallet</h3>
        <div className="wgrid">
          {WALLETS.map((w) => (
            <WalletButton.Custom key={w.id} wallet={w.id}>
              {({ connect, loading, connector }) => {
                if (!connector) return null
                const installed = connector.installed === true
                const busy = loading || pending === w.label
                return (
                  <button
                    className="wopt"
                    data-wallet={w.id}
                    disabled={busy}
                    onClick={async () => {
                      setPending(w.label)
                      try { await connect() } catch (e) { setPending(null); toast(shortError(e)) }
                      // Not installed: RainbowKit opened its own QR / download flow; clear our pending state.
                      if (!installed) setPending(null)
                    }}
                  >
                    <WalletIcon src={connector.iconUrl as IconSrc} bg={connector.iconBackground} />
                    <span className="wname">{w.label}<small>{busy ? 'Connecting…' : installed ? 'Installed' : connector.id === 'walletConnect' ? 'Scan with any wallet' : 'Get'}</small></span>
                  </button>
                )
              }}
            </WalletButton.Custom>
          ))}
          {hasInjected && injected && (
            <button
              className="wopt"
              data-wallet="injected"
              disabled={pending === 'Browser wallet'}
              onClick={async () => {
                setPending('Browser wallet')
                try { await connectAsync({ connector: injected, chainId: CHAIN_ID }) } catch (e) { setPending(null); toast(shortError(e)) }
              }}
            >
              <WalletIcon src={injectedDetails?.iconUrl} bg={injectedDetails?.iconBackground} />
              <span className="wname">Browser wallet<small>{pending === 'Browser wallet' ? 'Connecting…' : 'Installed'}</small></span>
            </button>
          )}
          {demo && (
            <button
              className="wopt"
              id="wdemo"
              data-wallet="demo"
              onClick={async () => {
                setPending('Demo wallet')
                try { await connectAsync({ connector: demo, chainId: CHAIN_ID }) } catch (e) { setPending(null); toast(shortError(e)) }
              }}
            >
              <span className="wicon" style={{ background: '#000' }} aria-hidden="true"><HalveMark size={18} /></span>
              <span className="wname">Demo wallet<small>mock mode · no extension needed</small></span>
            </button>
          )}
        </div>
        <div className="note">Network: Robinhood Chain ({CHAIN_ID}). You&apos;ll be asked to add or switch to it after connecting.{!HAS_WALLETCONNECT && ' Mobile wallets and WalletConnect appear once NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is set.'}</div>
      </div>
    </div>
  )
}
