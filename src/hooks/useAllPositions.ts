'use client'
import { useMemo } from 'react'
import { useAccount, useReadContracts } from 'wagmi'
import { zeroAddress, type ContractFunctionParameters } from 'viem'
import { SERIES } from '@/contracts/types'
import { erc20Abi } from '@/contracts/abis'
import { POLL_MS } from '@/contracts/constants'
import { MOCK_BALANCE } from '@/lib/mock'
import { useMockPositions } from '@/lib/mockStore'
import { toNumber } from '@/lib/math'
import { ok, type ReadResult } from '@/lib/stats'
import { isMockSeries } from './useSeries'
import { useIsMounted } from './useIsMounted'

export type PortfolioRow = { id: string; ticker: string; stock: number; pt: number; yt: number; lp: number; isMock: boolean }

/** PT / YT / stock balances for every series, one multicall. Backs the Portfolio tab. */
export function useAllPositions(): { rows: PortfolioRow[]; connected: boolean; isLoading: boolean } {
  const mounted = useIsMounted()
  const { address, isConnected } = useAccount()
  const connected = mounted && isConnected && !!address
  const owner = address ?? zeroAddress
  const { pos } = useMockPositions()
  const live = useMemo(() => SERIES.filter((s) => !isMockSeries(s)), [])
  const contracts = useMemo<ContractFunctionParameters[]>(
    () => live.flatMap((s) => [
      { address: s.underlying, abi: erc20Abi, functionName: 'balanceOf', args: [owner] },
      { address: s.pt, abi: erc20Abi, functionName: 'balanceOf', args: [owner] },
      { address: s.yt, abi: erc20Abi, functionName: 'balanceOf', args: [owner] },
    ]),
    [live, owner],
  )
  const q = useReadContracts({ contracts, allowFailure: true, query: { enabled: connected && contracts.length > 0, refetchInterval: POLL_MS } })
  const data = q.data as readonly ReadResult[] | undefined
  return useMemo(() => {
    let li = 0
    const rows = SERIES.map((s): PortfolioRow => {
      if (isMockSeries(s)) {
        const p = pos[s.ticker] ?? { pt: 0, yt: 0, lp: 0 }
        return { id: s.id, ticker: s.ticker, stock: connected ? MOCK_BALANCE : 0, pt: p.pt, yt: p.yt, lp: p.lp, isMock: true }
      }
      const b = li++ * 3
      return {
        id: s.id, ticker: s.ticker, isMock: false, lp: 0,
        stock: toNumber(ok<bigint>(data, b) ?? 0n, s.decimals),
        pt: toNumber(ok<bigint>(data, b + 1) ?? 0n, s.decimals),
        yt: toNumber(ok<bigint>(data, b + 2) ?? 0n, s.decimals),
      }
    })
    return { rows, connected, isLoading: connected && live.length > 0 && q.isLoading }
  }, [pos, connected, data, live.length, q.isLoading])
}
