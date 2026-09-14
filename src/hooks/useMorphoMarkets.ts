'use client'
import { useMemo } from 'react'
import { useReadContracts } from 'wagmi'
import type { ContractFunctionParameters } from 'viem'
import { SERIES } from '@/contracts/types'
import { morphoBlueAbi } from '@/contracts/abis'
import { POLL_MS } from '@/contracts/constants'
import { MOCK, MORPHO_BLUE } from '@/lib/env'
import { ok, type ReadResult } from '@/lib/stats'
import { toNumber } from '@/lib/math'

export type MorphoMarket = { supplied: number; borrowed: number; maxLtv: number } // amounts in loan-token units, maxLtv fraction

type Market = readonly [bigint, bigint, bigint, bigint, bigint, bigint]
type Params = readonly [`0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`, bigint]

/** Live Morpho Blue reads for series with a `morphoMarketId`. Empty map until NEXT_PUBLIC_MORPHO_BLUE and ids are set. */
export function useMorphoMarkets(): Map<string, MorphoMarket> {
  const targets = useMemo(() => (MOCK || !MORPHO_BLUE ? [] : SERIES.filter((s) => s.morphoMarketId)), [])
  const contracts = useMemo<ContractFunctionParameters[]>(
    () => targets.flatMap((s) => [
      { address: MORPHO_BLUE as `0x${string}`, abi: morphoBlueAbi, functionName: 'market', args: [s.morphoMarketId!] },
      { address: MORPHO_BLUE as `0x${string}`, abi: morphoBlueAbi, functionName: 'idToMarketParams', args: [s.morphoMarketId!] },
    ]),
    [targets],
  )
  const { data } = useReadContracts({ contracts, allowFailure: true, query: { enabled: contracts.length > 0, refetchInterval: POLL_MS } })
  return useMemo(() => {
    const out = new Map<string, MorphoMarket>()
    const d = data as readonly ReadResult[] | undefined
    targets.forEach((s, i) => {
      const m = ok<Market>(d, i * 2)
      const p = ok<Params>(d, i * 2 + 1)
      if (!m) return
      const dec = s.lend?.loanDecimals ?? 6
      out.set(s.id, { supplied: toNumber(m[0], dec), borrowed: toNumber(m[2], dec), maxLtv: p ? toNumber(p[4], 18) : 0 })
    })
    return out
  }, [data, targets])
}
