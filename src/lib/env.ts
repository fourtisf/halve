/**
 * Public runtime flags. `MOCK` (or `NEXT_PUBLIC_MOCK`) defaults to true so the
 * site renders with the prototype's numbers before series.json has real addresses.
 * next.config.ts maps MOCK → NEXT_PUBLIC_MOCK at build time.
 */
export const MOCK = (process.env.NEXT_PUBLIC_MOCK ?? 'true').toLowerCase() !== 'false'

export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || undefined

export const WALLETCONNECT_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'YOUR_WALLETCONNECT_PROJECT_ID'

/** Average block time on Robinhood Chain, used to size the 30d swap-log window. */
export const BLOCK_TIME_MS = Number(process.env.NEXT_PUBLIC_BLOCK_TIME_MS ?? '100') || 100
