import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { metaMaskWallet, rabbyWallet, walletConnectWallet } from '@rainbow-me/rainbowkit/wallets'
import { http } from 'wagmi'
import { robinhood as robinhoodBase } from 'wagmi/chains'
import { RPC_URL, WALLETCONNECT_PROJECT_ID } from './env'

/** Robinhood Chain, chain id 4663 (viem definition, RPC overridable via NEXT_PUBLIC_RPC_URL). */
export const robinhood = {
  ...robinhoodBase,
  rpcUrls: RPC_URL ? { default: { http: [RPC_URL] } } : robinhoodBase.rpcUrls,
} as const

export const CHAIN_ID = robinhood.id

export const wagmiConfig = getDefaultConfig({
  appName: 'Halve',
  appDescription: 'Fixed yield and dividend tokens for tokenized stocks',
  projectId: WALLETCONNECT_PROJECT_ID,
  chains: [robinhood],
  transports: { [robinhood.id]: http(RPC_URL ?? robinhood.rpcUrls.default.http[0], { batch: true }) },
  wallets: [{ groupName: 'Wallets', wallets: [metaMaskWallet, rabbyWallet, walletConnectWallet] }],
  ssr: true,
})

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig
  }
}
