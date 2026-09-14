/**
 * Public runtime flags. `MOCK` (or `NEXT_PUBLIC_MOCK`) defaults to true so the
 * site renders with the prototype's numbers before series.json has real addresses.
 * next.config.ts maps MOCK → NEXT_PUBLIC_MOCK at build time.
 */
export const MOCK = (process.env.NEXT_PUBLIC_MOCK ?? 'true').toLowerCase() !== 'false'

export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || undefined

/** Empty when not configured: the WalletConnect option is then hidden. */
export const WALLETCONNECT_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || ''
export const HAS_WALLETCONNECT = WALLETCONNECT_PROJECT_ID.length > 0

/** Average block time on Robinhood Chain, used to size the swap-log window for the YT chart fallback. */
export const BLOCK_TIME_MS = Number(process.env.NEXT_PUBLIC_BLOCK_TIME_MS ?? '100') || 100

/** Canonical site URL for metadata / OG images. Production is halve.finance; Vercel previews use their own URL. */
export const CANONICAL_URL = 'https://halve.finance'
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_ENV === 'preview' && process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : CANONICAL_URL)

/** Morpho Blue singleton on chain 4663. Lend markets read live from it when set. */
export const MORPHO_BLUE = (process.env.NEXT_PUBLIC_MORPHO_BLUE || '') as `0x${string}` | ''

/** Optional endpoint that receives client-side error reports (see lib/monitoring.ts). */
export const ERROR_ENDPOINT = process.env.NEXT_PUBLIC_ERROR_ENDPOINT || ''
