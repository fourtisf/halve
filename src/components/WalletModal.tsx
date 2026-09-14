'use client'
import { useEffect, useState } from 'react'
import { WalletButton } from '@rainbow-me/rainbowkit'
import { useAccount } from 'wagmi'
import { useWalletModal } from '@/lib/walletModal'
import { shortError, useToast } from '@/lib/toast'
import { CHAIN_ID } from '@/lib/wagmi'

/** RainbowKit wallet ids (matched case-insensitively by WalletButton). */
const WALLETS = [
  { id: 'metaMask', label: 'MetaMask' },
  { id: 'rabby', label: 'Rabby' },
  { id: 'walletConnect', label: 'WalletConnect' },
] as const

/** Prototype-styled wallet picker; each option connects through RainbowKit's connector for that wallet. */
export function WalletModal() {
  const { isOpen, close } = useWalletModal()
  const { toast } = useToast()
  const { isConnected } = useAccount()
  const [pending, setPending] = useState<string | null>(null)

  useEffect(() => {
    if (isConnected && pending) {
      close()
      toast(`Connected with ${pending}`)
      setPending(null)
    }
  }, [isConnected, pending, close, toast])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, close])

  return (
    <div className={'modal' + (isOpen ? ' open' : '')} id="wmodal" onClick={(e) => { if (e.target === e.currentTarget) close() }} role="dialog" aria-modal="true" aria-label="Connect a wallet">
      <div className="box">
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
        <div className="note">Network: Robinhood Chain ({CHAIN_ID}). You&apos;ll be asked to switch if needed.</div>
      </div>
    </div>
  )
}
