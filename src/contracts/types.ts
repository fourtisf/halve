import type { Address, Hex } from 'viem'
import { isAddress, isHex, zeroAddress } from 'viem'
import rawJson from './series.json'

export type Issuer = 'Robinhood' | 'Backed' | 'Dinari'

export type LendParams = {
  maxLtv: string // shown until Morpho lltv is read
  borrowApr: string // Morpho IRM rate — phase 2
  loanDecimals?: number // loan token decimals, default 6 (USDC)
}

/** Data model from CLAUDE.md, plus a few optional presentation fields. */
export type Series = {
  id: string // "JEPI-MAR27"
  ticker: string // "JEPI"
  name: string
  issuer: Issuer
  underlying: Address // ERC-8056 stock token
  vault: Address // StripVault
  pt: Address
  yt: Address
  accountant: Address // MultiplierAccountant
  poolPT: Address // Uniswap v3 PT/stock pool
  poolYT: Address // Uniswap v3 YT/stock pool
  maturity: number // unix ts
  cap: bigint // deposit cap, raw units
  // ---- extras (not in the CLAUDE.md model) ----
  priceFeed: Address // Chainlink stock/USD feed on chain 4663
  decimals: number // stock token decimals (PT/YT mirror it)
  schedule?: string // issuer's declared distribution schedule, e.g. "Oct 3 · monthly"
  lend?: LendParams // Morpho market presentation params
  morphoMarketId?: Hex // Morpho Blue market id (bytes32) for the pPT/USDC market
}

type RawSeries = {
  id: string
  ticker: string
  name: string
  issuer: string
  underlying: string
  vault: string
  pt: string
  yt: string
  accountant: string
  poolPT: string
  poolYT: string
  priceFeed?: string
  maturity: number
  cap: string
  decimals?: number
  schedule?: string
  lend?: LendParams
  morphoMarketId?: string
}

const raw = rawJson as unknown as RawSeries[]

function addr(v: string, field: string, id: string): Address {
  if (!isAddress(v)) throw new Error(`series.json: ${id}.${field} is not an address: ${v}`)
  return v
}

function parse(r: RawSeries): Series {
  const marketId = r.morphoMarketId && isHex(r.morphoMarketId) && r.morphoMarketId.length === 66 ? (r.morphoMarketId as Hex) : undefined
  return {
    id: r.id,
    ticker: r.ticker,
    name: r.name,
    issuer: r.issuer as Issuer,
    underlying: addr(r.underlying, 'underlying', r.id),
    vault: addr(r.vault, 'vault', r.id),
    pt: addr(r.pt, 'pt', r.id),
    yt: addr(r.yt, 'yt', r.id),
    accountant: addr(r.accountant, 'accountant', r.id),
    poolPT: addr(r.poolPT, 'poolPT', r.id),
    poolYT: addr(r.poolYT, 'poolYT', r.id),
    maturity: r.maturity,
    cap: BigInt(r.cap),
    priceFeed: addr(r.priceFeed ?? zeroAddress, 'priceFeed', r.id),
    decimals: r.decimals ?? 18,
    schedule: r.schedule,
    lend: r.lend,
    morphoMarketId: marketId,
  }
}

export const SERIES: readonly Series[] = raw.map(parse)

export const seriesById = (id: string): Series | undefined => SERIES.find((s) => s.id === id)

/** True while any core address is still the zero placeholder. */
export function hasPlaceholderAddresses(s: Series): boolean {
  return [s.underlying, s.vault, s.pt, s.yt, s.accountant, s.poolPT, s.poolYT].some((a) => a === zeroAddress)
}

/** Fields that still need a real address, for the summary / README. */
export function missingAddresses(s: Series): string[] {
  const keys = ['underlying', 'vault', 'pt', 'yt', 'accountant', 'poolPT', 'poolYT', 'priceFeed'] as const
  return keys.filter((k) => s[k] === zeroAddress)
}
