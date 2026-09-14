import { formatUnits } from 'viem'
import { WAD } from '@/contracts/constants'

export const YEAR_SECONDS = 365.25 * 24 * 3600

export const yearsToMaturity = (maturity: number, now = Date.now() / 1000): number =>
  Math.max((maturity - now) / YEAR_SECONDS, 1 / 365.25)

/** fixedApy = (1/ptPrice)^(1/yearsToMaturity) − 1 */
export const fixedApy = (ptPrice: number, years: number): number =>
  ptPrice > 0 ? Math.pow(1 / ptPrice, 1 / years) - 1 : 0

/** leverage = 1/ytPrice */
export const leverage = (ytPrice: number): number => (ytPrice > 0 ? 1 / ytPrice : 0)

/** Market-implied annual distribution yield from the YT price and time left. */
export const impliedDividendYield = (ytPrice: number, years: number): number => (years > 0 ? ytPrice / years : 0)

/** 1e18-scaled uint → float (dividendIndex, splitFactor, d0). */
export const wadToNumber = (v: bigint): number => Number(formatUnits(v, 18))

export const isWad = (v: bigint | undefined): v is bigint => typeof v === 'bigint' && v > 0n

/** accrued = dividendIndex / d0 − 1 */
export const accruedFrom = (dividendIndex: bigint, d0: bigint): number =>
  d0 > 0n ? Number((dividendIndex * WAD) / d0) / 1e18 - 1 : 0

const Q96 = 2n ** 96n

/**
 * Uniswap v3 sqrtPriceX96 → price of `token` quoted in the other pool token.
 * Both Halve pools are quoted in the stock, so this returns PT-or-YT per 1 stock unit.
 */
export function poolPrice(
  sqrtPriceX96: bigint,
  tokenIsToken0: boolean,
  tokenDecimals: number,
  quoteDecimals: number,
): number {
  if (sqrtPriceX96 === 0n) return 0
  // price1per0 = (sqrt/2^96)^2 scaled by decimals; computed in 1e18 fixed point
  const num = sqrtPriceX96 * sqrtPriceX96 * WAD
  const p1per0Raw = Number(num / (Q96 * Q96)) / 1e18
  const dec0 = tokenIsToken0 ? tokenDecimals : quoteDecimals
  const dec1 = tokenIsToken0 ? quoteDecimals : tokenDecimals
  const p1per0 = p1per0Raw * Math.pow(10, dec0 - dec1) // token1 per token0, human units
  return tokenIsToken0 ? p1per0 : p1per0 > 0 ? 1 / p1per0 : 0
}

export const toNumber = (v: bigint, decimals: number): number => Number(formatUnits(v, decimals))

/**
 * Classification bands from the oracle copy: growth between 0 and 3% is a dividend;
 * a clean small-integer ratio at least 20% from 1 is a split; anything else waits for a guardian.
 */
export function classifyRatio(r: number): 'Dividend' | 'Split' | 'Special dividend' | 'Unclassified' {
  if (r > 1 && r - 1 <= 0.03) return 'Dividend'
  if (Math.abs(r - 1) >= 0.2 && isCleanRatio(r)) return 'Split'
  if (r > 1) return 'Special dividend'
  return 'Unclassified'
}

function isCleanRatio(r: number): boolean {
  for (let q = 1; q <= 20; q++) {
    const p = r * q
    if (Math.abs(p - Math.round(p)) < 1e-6 && Math.round(p) >= 1 && Math.round(p) <= 100) return true
  }
  return false
}
