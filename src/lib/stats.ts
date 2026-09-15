/** Pure helpers behind useSeriesStats: multicall layout and result parsing. Unit-tested. */
import type { Address, ContractFunctionParameters } from 'viem'
import type { Series } from '@/contracts/types'
import { chainlinkAggregatorAbi, erc20Abi, multiplierAccountantAbi, stripVaultAbi, uniswapV3PoolAbi } from '@/contracts/abis'
import type { SeriesStats } from './types'
import { accruedFrom, fixedApy, impliedDividendYield, leverage, poolPrice, toNumber, wadToNumber, yearsToMaturity } from './math'

export type ReadResult = { status: 'success'; result: unknown } | { status: 'failure'; error: Error }

export function ok<T>(data: readonly ReadResult[] | undefined, i: number): T | undefined {
  const r = data?.[i]
  return r && r.status === 'success' ? (r.result as T) : undefined
}

export const STATS_PER_SERIES = 17

export function statsContracts(s: Series): ContractFunctionParameters[] {
  return [
    { address: s.vault, abi: stripVaultAbi, functionName: 'totalDeposits' },
    { address: s.vault, abi: stripVaultAbi, functionName: 'cap' },
    { address: s.vault, abi: stripVaultAbi, functionName: 'd0' },
    { address: s.vault, abi: stripVaultAbi, functionName: 'state' },
    { address: s.accountant, abi: multiplierAccountantAbi, functionName: 'dividendIndex' },
    { address: s.accountant, abi: multiplierAccountantAbi, functionName: 'splitFactor' },
    { address: s.accountant, abi: multiplierAccountantAbi, functionName: 'isSynced' },
    { address: s.accountant, abi: multiplierAccountantAbi, functionName: 'checkpointCount' },
    { address: s.poolPT, abi: uniswapV3PoolAbi, functionName: 'slot0' },
    { address: s.poolPT, abi: uniswapV3PoolAbi, functionName: 'token0' },
    { address: s.poolYT, abi: uniswapV3PoolAbi, functionName: 'slot0' },
    { address: s.poolYT, abi: uniswapV3PoolAbi, functionName: 'token0' },
    { address: s.underlying, abi: erc20Abi, functionName: 'decimals' },
    { address: s.pt, abi: erc20Abi, functionName: 'decimals' },
    { address: s.yt, abi: erc20Abi, functionName: 'decimals' },
    { address: s.priceFeed, abi: chainlinkAggregatorAbi, functionName: 'latestRoundData' },
    { address: s.priceFeed, abi: chainlinkAggregatorAbi, functionName: 'decimals' },
  ]
}

export type Slot0 = readonly [bigint, number, number, number, number, number, boolean]
export type Round = readonly [bigint, bigint, bigint, bigint, bigint]

/** StripVault.state(): 0 Active, 1 Matured (settle() callable), 2 Settled (redeem open). */
export const VAULT_STATE = { Active: 0, Matured: 1, Settled: 2 } as const

export function parseStats(s: Series, data: readonly ReadResult[] | undefined, base: number, now: number): SeriesStats {
  const totalDeposits = ok<bigint>(data, base + 0) ?? 0n
  const cap = ok<bigint>(data, base + 1) ?? s.cap
  const d0 = ok<bigint>(data, base + 2)
  const state = Number(ok<number>(data, base + 3) ?? 0)
  const dividendIndex = ok<bigint>(data, base + 4)
  const splitFactor = ok<bigint>(data, base + 5)
  const isSynced = ok<boolean>(data, base + 6) ?? true
  const events = Number(ok<bigint>(data, base + 7) ?? 0n)
  const slotPT = ok<Slot0>(data, base + 8)
  const token0PT = ok<Address>(data, base + 9)
  const slotYT = ok<Slot0>(data, base + 10)
  const token0YT = ok<Address>(data, base + 11)
  const stockDec = Number(ok<number>(data, base + 12) ?? s.decimals)
  const ptDec = Number(ok<number>(data, base + 13) ?? stockDec)
  const ytDec = Number(ok<number>(data, base + 14) ?? stockDec)
  const round = ok<Round>(data, base + 15)
  const feedDec = Number(ok<number>(data, base + 16) ?? 8)

  const ptPrice = slotPT && token0PT ? poolPrice(slotPT[0], token0PT.toLowerCase() === s.pt.toLowerCase(), ptDec, stockDec) : 0
  const ytPrice = slotYT && token0YT ? poolPrice(slotYT[0], token0YT.toLowerCase() === s.yt.toLowerCase(), ytDec, stockDec) : 0
  const years = yearsToMaturity(s.maturity, now)
  // Chainlink prices the token with the multiplier inside — do NOT multiply by uiMultiplier again.
  const usdPrice = round ? Number(round[1]) / 10 ** feedDec : 0
  const tvlUsd = toNumber(totalDeposits, stockDec) * usdPrice

  return {
    isMock: false,
    ready: !!(slotPT && slotYT),
    ptPrice,
    ytPrice,
    fixedApy: fixedApy(ptPrice, years),
    leverage: leverage(ytPrice),
    divYield: impliedDividendYield(ytPrice, years),
    yearsToMaturity: years,
    totalDeposits,
    cap,
    capacityUsed: cap > 0n ? Number((totalDeposits * 10_000n) / cap) / 10_000 : 0,
    usdPrice,
    tvlUsd,
    dividendIndex: dividendIndex !== undefined ? wadToNumber(dividendIndex) : 1,
    d0: d0 !== undefined ? wadToNumber(d0) : 1,
    accrued: dividendIndex !== undefined && d0 !== undefined ? accruedFrom(dividendIndex, d0) : 0,
    splitFactor: splitFactor !== undefined ? wadToNumber(splitFactor) : 1,
    isSynced,
    events,
    state,
    decimals: stockDec,
    tvlChange7d: null, // filled from the KV history when available
    ytChange24h: null, // filled by useYtHistory
  }
}

/** True once the series can be settled / redeemed (by clock or by vault state). */
export const isMatured = (s: Series, stats: SeriesStats, now = Date.now() / 1000): boolean =>
  now >= s.maturity || stats.state >= VAULT_STATE.Matured

export const isSettled = (stats: SeriesStats): boolean => stats.state >= VAULT_STATE.Settled
