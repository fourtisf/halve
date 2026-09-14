/** Redemption quotes after maturity. Pure, unit-tested. Assumptions are documented in README. */
import { YIELD_REDEMPTION_FEE } from '@/contracts/constants'

/** redeemPT(amount): 1 PT → 1 share of the stock. */
export const quoteRedeemPT = (amount: number): { out: number; fee: number } => ({ out: amount, fee: 0 })

/**
 * redeemYT(amount): the YT's share of dividends reinvested since d0, in stock units,
 * minus the 5 % yield redemption fee. accrued = dividendIndex / d0 − 1.
 */
export const quoteRedeemYT = (amount: number, accrued: number): { out: number; fee: number } => {
  const gross = amount * Math.max(0, accrued)
  const fee = gross * YIELD_REDEMPTION_FEE
  return { out: gross - fee, fee }
}
