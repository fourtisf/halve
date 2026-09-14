'use client'
import { useMemo } from 'react'
import { useAccount, useReadContracts } from 'wagmi'
import { maxUint256, zeroAddress, type ContractFunctionParameters } from 'viem'
import type { Series } from '@/contracts/types'
import { erc20Abi } from '@/contracts/abis'
import { POLL_MS } from '@/contracts/constants'
import { CHAIN_ID } from '@/lib/wagmi'
import { MOCK_BALANCE } from '@/lib/mock'
import { useMockPositions } from '@/lib/mockStore'
import { toNumber } from '@/lib/math'
import type { PositionData } from '@/lib/types'
import { isMockSeries } from './useSeries'
import { useIsMounted } from './useIsMounted'
import { ok, type ReadResult } from './readResult'

const noop = () => {}

/** PT / YT / stock balances and vault allowances for the connected address. LP is phase 2 (router). */
export function usePosition(series: Series): PositionData {
  const mock = isMockSeries(series)
  const mounted = useIsMounted()
  const { address, isConnected, chainId } = useAccount()
  const connected = mounted && isConnected && !!address
  const wrongChain = connected && chainId !== CHAIN_ID
  const { pos } = useMockPositions()
  const owner = address ?? zeroAddress

  const contracts = useMemo<ContractFunctionParameters[]>(
    () => [
      { address: series.underlying, abi: erc20Abi, functionName: 'balanceOf', args: [owner] },
      { address: series.pt, abi: erc20Abi, functionName: 'balanceOf', args: [owner] },
      { address: series.yt, abi: erc20Abi, functionName: 'balanceOf', args: [owner] },
      { address: series.underlying, abi: erc20Abi, functionName: 'allowance', args: [owner, series.vault] },
      { address: series.pt, abi: erc20Abi, functionName: 'allowance', args: [owner, series.vault] },
      { address: series.yt, abi: erc20Abi, functionName: 'allowance', args: [owner, series.vault] },
    ],
    [series, owner],
  )
  const q = useReadContracts({ contracts, allowFailure: true, query: { enabled: !mock && connected, refetchInterval: POLL_MS } })
  const data = q.data as readonly ReadResult[] | undefined
  const refetch = q.refetch

  return useMemo<PositionData>(() => {
    if (mock) {
      const p = pos[series.ticker] ?? { pt: 0, yt: 0, lp: 0 }
      const stock = connected ? MOCK_BALANCE : 0
      return {
        isMock: true, connected, wrongChain, stock, pt: p.pt, yt: p.yt, lp: p.lp,
        stockRaw: 0n, ptRaw: 0n, ytRaw: 0n,
        allowance: { stock: maxUint256, pt: maxUint256, yt: maxUint256 },
        refetch: noop,
      }
    }
    const d = series.decimals
    const stockRaw = ok<bigint>(data, 0) ?? 0n
    const ptRaw = ok<bigint>(data, 1) ?? 0n
    const ytRaw = ok<bigint>(data, 2) ?? 0n
    return {
      isMock: false, connected, wrongChain,
      stock: toNumber(stockRaw, d), pt: toNumber(ptRaw, d), yt: toNumber(ytRaw, d), lp: 0,
      stockRaw, ptRaw, ytRaw,
      allowance: { stock: ok<bigint>(data, 3) ?? 0n, pt: ok<bigint>(data, 4) ?? 0n, yt: ok<bigint>(data, 5) ?? 0n },
      refetch: () => { void refetch() },
    }
  }, [mock, pos, series.ticker, series.decimals, connected, wrongChain, data, refetch])
}
