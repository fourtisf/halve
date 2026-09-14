/** Protocol constants mirrored from the prototype copy. Verify against deployed contracts. */
export const SPLIT_FEE = 0.001 // 0.10 %, taken once in the share on the way in
export const MERGE_FEE = 0 // always free
export const GUARDIAN_TIMELOCK_SECONDS = 2 * 24 * 60 * 60 // "two-day public timelock"
export const WAD = 10n ** 18n // 1e18 = 1.0 for dividendIndex / splitFactor
export const POLL_MS = 12_000 // TanStack polling interval for on-chain reads
export const CHART_DAYS = 30
export const EARN_TIERS = { pt: '0.05%', yt: '1%' } as const
