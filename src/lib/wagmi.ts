import { connectorsForWallets } from '@rainbow-me/rainbowkit'
import { metaMaskWallet, rabbyWallet, walletConnectWallet } from '@rainbow-me/rainbowkit/wallets'
import { createConfig, http } from 'wagmi'
import { mock } from 'wagmi/connectors'
import type { Address } from 'viem'
import { HAS_WALLETCONNECT, MOCK, WALLETCONNECT_PROJECT_ID } from './env'
import { RPC_HTTP, robinhood } from './chain'

export { CHAIN_ID, EXPLORER, explorerAddress, explorerTx, robinhood } from './chain'

/** Demo account used by the mock connector in MOCK mode. Renders as 0x7A3f…C32F, like the prototype. */
export const DEMO_ADDRESS: Address = '0x7A3fBfD642293398Dc260198e0A376e7Da9bC32F'
export const DEMO_CONNECTOR_ID = 'mock'

const walletList = [metaMaskWallet, rabbyWallet, ...(HAS_WALLETCONNECT ? [walletConnectWallet] : [])]

const rainbowConnectors = connectorsForWallets([{ groupName: 'Wallets', wallets: walletList }], {
  appName: 'Halve',
  appDescription: 'Fixed yield and dividend tokens for tokenized stocks',
  projectId: WALLETCONNECT_PROJECT_ID || 'halve-no-walletconnect',
})

export const wagmiConfig = createConfig({
  chains: [robinhood],
  transports: { [robinhood.id]: http(RPC_HTTP, { batch: true }) },
  connectors: [...rainbowConnectors, ...(MOCK ? [mock({ accounts: [DEMO_ADDRESS], features: { reconnect: true } })] : [])],
  ssr: true,
})

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig
  }
}
