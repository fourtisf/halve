/** Redemption quotes after maturity, in raw stock tokens. Pure, unit-tested. */
import { YIELD_REDEMPTION_FEE } from '@/contracts/constants'
import { principalPerPT } from './math'

/** redeemPT(amount): amount × d0 / dm raw tokens — the share count, reinvested dividends removed. */
export const quoteRedeemPT = (amount: number, accrued: number): { out: number; fee: number } => ({ out: amount * principalPerPT(accrued), fee: 0 })

/** The raw tokens a YT balance is worth right now: amount × (1 − d0 / D), before the fee. */
export const ytClaim = (amount: number, accrued: number): number => amount * (1 - principalPerPT(accrued))

/** redeemYT(amount): the reinvested dividends since d0, minus the 5 % yield redemption fee. */
export const quoteRedeemYT = (amount: number, accrued: number): { out: number; fee: number } => {
  const gross = ytClaim(amount, accrued)
  const fee = gross * YIELD_REDEMPTION_FEE
  return { out: gross - fee, fee }
}
