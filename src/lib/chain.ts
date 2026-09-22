/** Robinhood Chain (4663) definition shared by client (wagmi) and server (sampler). No client-only imports here. */
import { robinhood as robinhoodBase } from 'viem/chains'
import { fallback, http, isAddress, type Address, type Hash } from 'viem'
import { RPC_URLS } from './env'

export const robinhood = {
  ...robinhoodBase,
  rpcUrls: RPC_URLS.length > 0 ? { default: { http: [...RPC_URLS] } } : robinhoodBase.rpcUrls,
} as const

export const CHAIN_ID = robinhood.id

/** Uniswap v3 on Robinhood Chain, as published in @uniswap/sdk-core (ROBINHOOD_ADDRESSES / WETH9). Overridable for local chains. */
/** A build-time override becomes an approval spender, so anything that is not an address fails the build. */
function override(name: string, value: string | undefined, fallback: Address): Address {
  if (!value) return fallback
  if (!isAddress(value)) throw new Error(`${name} is not an address: ${value}`)
  return value
}

export const UNISWAP = {
  router: override('NEXT_PUBLIC_UNISWAP_ROUTER', process.env.NEXT_PUBLIC_UNISWAP_ROUTER, '0xcaf681a66d020601342297493863e78c959e5cb2'), // SwapRouter02
  quoter: override('NEXT_PUBLIC_UNISWAP_QUOTER', process.env.NEXT_PUBLIC_UNISWAP_QUOTER, '0x33e885ed0ec9bf04ecfb19341582aadcb4c8a9e7'), // QuoterV2
  weth: override('NEXT_PUBLIC_WETH', process.env.NEXT_PUBLIC_WETH, '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73'), // WETH9
  npm: override('NEXT_PUBLIC_UNISWAP_NPM', process.env.NEXT_PUBLIC_UNISWAP_NPM, '0x73991a25c818bf1f1128deaab1492d45638de0d3'), // NonfungiblePositionManager (limit orders)
} as const
/** Every RPC URL in priority order (at least the chain's default). */
export const RPC_HTTPS: readonly string[] = robinhood.rpcUrls.default.http
export const RPC_HTTP = RPC_HTTPS[0]

/**
 * The one transport every client uses: plain http with a single URL, viem's `fallback` over several (a request
 * that fails on one RPC is retried on the next, in the order configured; the public RPC rate-limiting or going
 * down then costs latency, not the site).
 */
export const rpcTransport = (opts: { batch?: boolean; timeout?: number } = {}) =>
  RPC_HTTPS.length > 1 ? fallback(RPC_HTTPS.map((u) => http(u, opts)), { rank: false }) : http(RPC_HTTP, opts)

export const EXPLORER = robinhood.blockExplorers.default.url
export const explorerTx = (hash: Hash) => `${EXPLORER}/tx/${hash}`
export const explorerAddress = (a: Address) => `${EXPLORER}/address/${a}`
