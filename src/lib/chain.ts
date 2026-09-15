/** Robinhood Chain (4663) definition shared by client (wagmi) and server (sampler). No client-only imports here. */
import { robinhood as robinhoodBase } from 'viem/chains'
import type { Address, Hash } from 'viem'
import { RPC_URL } from './env'

export const robinhood = {
  ...robinhoodBase,
  rpcUrls: RPC_URL ? { default: { http: [RPC_URL] } } : robinhoodBase.rpcUrls,
} as const

export const CHAIN_ID = robinhood.id

/** Uniswap v3 on Robinhood Chain, as published in @uniswap/sdk-core (ROBINHOOD_ADDRESSES / WETH9). Overridable for local chains. */
export const UNISWAP = {
  router: (process.env.NEXT_PUBLIC_UNISWAP_ROUTER || '0xcaf681a66d020601342297493863e78c959e5cb2') as Address, // SwapRouter02
  quoter: (process.env.NEXT_PUBLIC_UNISWAP_QUOTER || '0x33e885ed0ec9bf04ecfb19341582aadcb4c8a9e7') as Address, // QuoterV2
  weth: (process.env.NEXT_PUBLIC_WETH || '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73') as Address, // WETH9
} as const
export const RPC_HTTP = RPC_URL ?? robinhood.rpcUrls.default.http[0]
export const EXPLORER = robinhood.blockExplorers.default.url
export const explorerTx = (hash: Hash) => `${EXPLORER}/tx/${hash}`
export const explorerAddress = (a: Address) => `${EXPLORER}/address/${a}`
