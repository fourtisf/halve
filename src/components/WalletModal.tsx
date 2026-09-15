'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { WalletButton } from '@rainbow-me/rainbowkit'
import { useAccount, useConnect, useConnectors, type Connector } from 'wagmi'
import { useWalletModal } from '@/lib/walletModal'
import { shortError, useToast } from '@/lib/toast'
import { CHAIN_ID, DEMO_CONNECTOR_ID } from '@/lib/wagmi'
import { HAS_WALLETCONNECT, MOCK } from '@/lib/env'
import { RDNS_TO_WALLET, WALLET_APP_LINKS, isCoarsePointer } from '@/lib/walletLinks'
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
/** Wallets whose own SDK handles the not-installed / mobile case without WalletConnect. */
const SDK_WALLETS = new Set(['metaMask', 'coinbase', 'walletConnect'])

const FOCUSABLE = 'button:not([disabled]), a[href], input, [tabindex]:not([tabindex="-1"])'
type IconSrc = string | (() => Promise<string>) | undefined
type RkDetails = { iconUrl?: IconSrc; iconBackground?: string; downloadUrls?: { browserExtension?: string; chrome?: string; firefox?: string; qrCode?: string; mobile?: string } }
const rk = (c: Connector | undefined) => (c as unknown as { rkDetails?: RkDetails } | undefined)?.rkDetails

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

function Option({ id, icon, bg, label, status, disabled, onClick, href }: { id: string; icon?: IconSrc; bg?: string; label: string; status: string; disabled?: boolean; onClick?: () => void; href?: string }) {
  const inner = <><WalletIcon src={icon} bg={bg} /><span className="wname">{label}<small>{status}</small></span></>
  if (href) return <a className="wopt" data-wallet={id} href={href} target="_blank" rel="noopener noreferrer">{inner}</a>
  return <button className="wopt" data-wallet={id} disabled={disabled} onClick={onClick}>{inner}</button>
}

/** Prototype-styled wallet picker. Every path here works without a WalletConnect project id. */
export function WalletModal() {
  const { isOpen, close } = useWalletModal()
  const { toast } = useToast()
  const { isConnected } = useAccount()
  const connectors = useConnectors()
  const { connectAsync } = useConnect()
  const [pending, setPending] = useState<string | null>(null)
  const [env, setEnv] = useState({ injected: false, mobile: false, url: '' })
  const box = useRef<HTMLDivElement>(null)
  const restore = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!isConnected || !isOpen) return
    close()
    if (pending) toast(`Connected with ${pending}`)
    setPending(null)
  }, [isConnected, isOpen, pending, close, toast])

  // Browser facts, decided after hydration so SSR and the first client render match.
  useEffect(() => {
    setEnv({ injected: !!(window as { ethereum?: unknown }).ethereum, mobile: isCoarsePointer(), url: window.location.href })
  }, [isOpen])

  // Focus trap: focus the first option on open, keep Tab inside the box, restore focus on close.
  useEffect(() => {
    if (!isOpen) return
    restore.current = document.activeElement as HTMLElement | null
    box.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus()
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
    return () => { window.removeEventListener('keydown', onKey); restore.current?.focus?.() }
  }, [isOpen, close])

  const demo = MOCK ? connectors.find((c) => c.id === DEMO_CONNECTOR_ID) : undefined
  const generic = connectors.find((c) => c.id === 'injected')
  /** Wallets announced by the browser via EIP-6963 that have no dedicated entry above. */
  const discovered = useMemo(
    () => connectors.filter((c) => c.type === 'injected' && !rk(c) && c.id !== 'injected' && !RDNS_TO_WALLET[c.id]),
    [connectors],
  )

  const connectWith = async (label: string, connector: Connector) => {
    setPending(label)
    try { await connectAsync({ connector, chainId: CHAIN_ID }) } catch (e) { setPending(null); toast(shortError(e)) }
  }

  return (
    <div className={'modal' + (isOpen ? ' open' : '')} id="wmodal" onClick={(e) => { if (e.target === e.currentTarget) close() }} role="dialog" aria-modal="true" aria-label="Connect a wallet" aria-hidden={!isOpen}>
      <div className="box" ref={box}>
        <h3>Connect a wallet</h3>

        {(discovered.length > 0 || (env.injected && generic && discovered.length === 0)) && (
          <>
            <div className="wsec">Detected in your browser</div>
            <div className="wgrid" id="wdetected">
              {discovered.map((c) => (
                <Option key={c.id} id={c.id} icon={c.icon} bg="#fff" label={c.name} status={pending === c.name ? 'Connecting…' : 'Installed'} disabled={pending === c.name} onClick={() => connectWith(c.name, c)} />
              ))}
              {discovered.length === 0 && env.injected && generic && (
                <Option id="injected" icon={rk(generic)?.iconUrl} bg={rk(generic)?.iconBackground} label="Browser wallet" status={pending === 'Browser wallet' ? 'Connecting…' : 'Installed'} disabled={pending === 'Browser wallet'} onClick={() => connectWith('Browser wallet', generic)} />
              )}
            </div>
          </>
        )}

        <div className="wsec">Wallets</div>
        <div className="wgrid">
          {WALLETS.map((w) => (
            <WalletButton.Custom key={w.id} wallet={w.id}>
              {({ connect, loading, connector }) => {
                if (!connector) return null
                const installed = connector.installed === true
                const busy = loading || pending === w.label
                const canConnect = installed || SDK_WALLETS.has(w.id)
                const download = connector.extensionDownloadUrl ?? connector.downloadUrls?.browserExtension ?? connector.downloadUrls?.qrCode
                if (!canConnect && download) {
                  return <Option id={w.id} icon={connector.iconUrl as IconSrc} bg={connector.iconBackground} label={w.label} status="Get extension" href={download} />
                }
                return (
                  <Option
                    id={w.id}
                    icon={connector.iconUrl as IconSrc}
                    bg={connector.iconBackground}
                    label={w.label}
                    status={busy ? 'Connecting…' : installed ? 'Installed' : w.id === 'walletConnect' ? 'Scan with any wallet' : 'Connect'}
                    disabled={busy}
                    onClick={async () => {
                      setPending(w.label)
                      try { await connect() } catch (e) { setPending(null); toast(shortError(e)) }
                      if (!installed) setPending(null) // the wallet's own SDK / QR flow took over
                    }}
                  />
                )
              }}
            </WalletButton.Custom>
          ))}
          {demo && (
            <button className="wopt" id="wdemo" data-wallet="demo" disabled={pending === 'Demo wallet'} onClick={() => connectWith('Demo wallet', demo)}>
              <span className="wicon" style={{ background: '#000' }} aria-hidden="true"><HalveMark size={18} /></span>
              <span className="wname">Demo wallet<small>mock mode · no extension needed</small></span>
            </button>
          )}
        </div>

        {env.mobile && !env.injected && env.url && (
          <>
            <div className="wsec">On your phone? Open this page in your wallet app</div>
            <div className="wgrid" id="wapps">
              {WALLET_APP_LINKS.map((l) => (
                <a key={l.id} className="wopt" data-app={l.id} href={l.href(env.url)} rel="noopener noreferrer">
                  <span className="wicon" style={{ background: 'var(--line2)' }} aria-hidden="true">↗</span>
                  <span className="wname">{l.label}<small>opens halve.finance inside the app</small></span>
                </a>
              ))}
            </div>
          </>
        )}

        <div className="note">Network: Robinhood Chain ({CHAIN_ID}). You&apos;ll be asked to add or switch to it after connecting.</div>
      </div>
    </div>
  )
}
