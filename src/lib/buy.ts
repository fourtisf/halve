/** Buying PT / YT through Uniswap v3 (SwapRouter02 + QuoterV2). Pure helpers, unit-tested. */
import { concatHex, numberToHex, type Address, type Hex } from 'viem'

export const FEE_TIERS = [500, 3000, 10000] as const
export const DEFAULT_SLIPPAGE_BPS = 100 // 1 %

/** Uniswap v3 multi-hop path: token0 | fee | token1 | fee | token2 … (20 + 3 + 20 … bytes). */
export function encodePath(tokens: readonly Address[], fees: readonly number[]): Hex {
  if (tokens.length !== fees.length + 1) throw new Error('path: tokens.length must be fees.length + 1')
  const parts: Hex[] = []
  tokens.forEach((t, i) => {
    parts.push(t)
    if (i < fees.length) parts.push(numberToHex(fees[i], { size: 3 }))
  })
  return concatHex(parts)
}

export const applySlippage = (amountOut: bigint, bps = DEFAULT_SLIPPAGE_BPS): bigint => (amountOut * BigInt(10_000 - bps)) / 10_000n

export type Route = { tokens: Address[]; fees: number[]; label: string }

/** Candidate routes: pay with the stock directly (one hop), or with ETH through every fee tier of the WETH/stock pool. */
export function candidateRoutes(payWith: 'eth' | 'stock', weth: Address, stock: Address, token: Address, poolFee: number, symbols: { stock: string; token: string }): Route[] {
  if (payWith === 'stock') return [{ tokens: [stock, token], fees: [poolFee], label: `${symbols.stock} → ${symbols.token}` }]
  return FEE_TIERS.map((f) => ({ tokens: [weth, stock, token], fees: [f, poolFee], label: `ETH → ${symbols.stock} (${f / 10_000}%) → ${symbols.token}` }))
}

export type Quote = { route: Route; amountOut: bigint }

/** The route paying the most. */
export function bestQuote(quotes: readonly (Quote | null)[]): Quote | null {
  return quotes.reduce<Quote | null>((best, q) => (q && (!best || q.amountOut > best.amountOut) ? q : best), null)
}

export const swapRouter02Abi = [
  {
    type: 'function', name: 'exactInput', stateMutability: 'payable',
    inputs: [{ name: 'params', type: 'tuple', components: [
      { name: 'path', type: 'bytes' }, { name: 'recipient', type: 'address' }, { name: 'amountIn', type: 'uint256' }, { name: 'amountOutMinimum', type: 'uint256' },
    ] }],
    outputs: [{ name: 'amountOut', type: 'uint256' }],
  },
] as const

export const quoterV2Abi = [
  {
    type: 'function', name: 'quoteExactInput', stateMutability: 'nonpayable',
    inputs: [{ name: 'path', type: 'bytes' }, { name: 'amountIn', type: 'uint256' }],
    outputs: [
      { name: 'amountOut', type: 'uint256' }, { name: 'sqrtPriceX96AfterList', type: 'uint160[]' },
      { name: 'initializedTicksCrossedList', type: 'uint32[]' }, { name: 'gasEstimate', type: 'uint256' },
    ],
  },
] as const
