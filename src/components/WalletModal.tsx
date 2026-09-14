'use client'
import { useEffect, useRef, useState } from 'react'
import { WalletButton } from '@rainbow-me/rainbowkit'
import { useAccount, useConnect, useConnectors } from 'wagmi'
import { useWalletModal } from '@/lib/walletModal'
import { shortError, useToast } from '@/lib/toast'
import { CHAIN_ID, DEMO_CONNECTOR_ID } from '@/lib/wagmi'
import { HAS_WALLETCONNECT, MOCK } from '@/lib/env'

/** RainbowKit wallet ids (matched case-insensitively by WalletButton). */
const WALLETS = [
  { id: 'metaMask', label: 'MetaMask' },
  { id: 'rabby', label: 'Rabby' },
  ...(HAS_WALLETCONNECT ? [{ id: 'walletConnect', label: 'WalletConnect' }] : []),
]

const FOCUSABLE = 'button:not([disabled]), a[href], input, [tabindex]:not([tabindex="-1"])'

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
    if (isConnected && pending) {
      close()
      toast(`Connected with ${pending}`)
      setPending(null)
    }
  }, [isConnected, pending, close, toast])

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
        {WALLETS.map((w) => (
          <WalletButton.Custom key={w.id} wallet={w.id}>
            {({ connect, loading }) => (
              <button
                className="wopt"
                disabled={loading}
                onClick={async () => {
                  setPending(w.label)
                  try { await connect() } catch (e) { setPending(null); toast(shortError(e)) }
                }}
              >
                <i />{w.label}
              </button>
            )}
          </WalletButton.Custom>
        ))}
        {demo && (
          <button
            className="wopt"
            id="wdemo"
            onClick={async () => {
              setPending('Demo wallet')
              try { await connectAsync({ connector: demo, chainId: CHAIN_ID }) } catch (e) { setPending(null); toast(shortError(e)) }
            }}
          >
            <i />Demo wallet <span className="m" style={{ fontWeight: 400, fontSize: 12 }}>· mock mode</span>
          </button>
        )}
        <div className="note">Network: Robinhood Chain ({CHAIN_ID}). You&apos;ll be asked to switch if needed.{!HAS_WALLETCONNECT && ' WalletConnect appears once NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is set.'}</div>
      </div>
    </div>
  )
}
