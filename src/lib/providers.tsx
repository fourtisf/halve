'use client'
import '@rainbow-me/rainbowkit/styles.css'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit'
import { WagmiProvider, useAccount, useSwitchChain } from 'wagmi'
import { CHAIN_ID, robinhood, wagmiConfig } from './wagmi'
import { POLL_MS } from '@/contracts/constants'
import { ToastProvider } from './toast'
import { WalletModalProvider } from './walletModal'
import { MockPositionProvider } from './mockStore'

const theme = darkTheme({ accentColor: '#FAFAFA', accentColorForeground: '#000', borderRadius: 'medium', fontStack: 'system', overlayBlur: 'small' })
theme.colors.modalBackground = '#0A0A0A'
theme.colors.modalBorder = '#2E2E2E'
theme.colors.modalText = '#FAFAFA'
theme.colors.modalTextSecondary = '#A1A1A1'
theme.colors.profileForeground = '#0A0A0A'
theme.colors.generalBorder = '#1F1F1F'
theme.colors.actionButtonBorder = '#2E2E2E'
theme.colors.closeButtonBackground = '#121212'
theme.colors.connectButtonBackground = '#0A0A0A'
theme.fonts.body = 'var(--font-inter), Inter, system-ui, sans-serif'

/** Prompts a chain switch to Robinhood Chain (4663) whenever a wallet connects on another network. */
function ChainGuard() {
  const { isConnected, chainId } = useAccount()
  const { switchChain } = useSwitchChain()
  const asked = useRef(false)
  useEffect(() => {
    if (!isConnected) { asked.current = false; return }
    if (chainId !== CHAIN_ID && !asked.current) {
      asked.current = true
      switchChain({ chainId: CHAIN_ID })
    }
  }, [isConnected, chainId, switchChain])
  return null
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { refetchInterval: POLL_MS, staleTime: POLL_MS / 2, retry: 1 } } }),
  )
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={theme} initialChain={robinhood} modalSize="compact" appInfo={{ appName: 'Halve' }}>
          <ToastProvider>
            <WalletModalProvider>
              <MockPositionProvider>
                <ChainGuard />
                {children}
              </MockPositionProvider>
            </WalletModalProvider>
          </ToastProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
