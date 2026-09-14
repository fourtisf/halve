/** Robinhood Chain (4663) definition shared by client (wagmi) and server (sampler). No client-only imports here. */
import { robinhood as robinhoodBase } from 'viem/chains'
import type { Address, Hash } from 'viem'
import { RPC_URL } from './env'

export const robinhood = {
  ...robinhoodBase,
  rpcUrls: RPC_URL ? { default: { http: [RPC_URL] } } : robinhoodBase.rpcUrls,
} as const

export const CHAIN_ID = robinhood.id
export const RPC_HTTP = RPC_URL ?? robinhood.rpcUrls.default.http[0]
export const EXPLORER = robinhood.blockExplorers.default.url
export const explorerTx = (hash: Hash) => `${EXPLORER}/tx/${hash}`
export const explorerAddress = (a: Address) => `${EXPLORER}/address/${a}`
