'use client'
import { useMemo } from 'react'
import { useReadContracts } from 'wagmi'
import type { ContractFunctionParameters } from 'viem'
import type { Series } from '@/contracts/types'
import { multiplierAccountantAbi } from '@/contracts/abis'
import { POLL_MS } from '@/contracts/constants'
import { mockLedger } from '@/lib/mock'
import { buildLedger, type Checkpoint, type PendingTuple } from '@/lib/ledger'
import { ok, type ReadResult } from '@/lib/stats'
import type { Ledger } from '@/lib/types'
import { useMarket } from './useMarket'
import { isMockSeries } from './useSeries'

const PROBE = 32 // if checkpointCount() is absent, probe checkpointAt(0..31) and stop at the first revert

/** Dividend ledger: checkpointAt(i) for i in 0..n, newest first; pending() rendered as a held row. */
export function useLedger(series: Series): Ledger {
  const mock = isMockSeries(series)
  const { preview } = useMarket() // real prices, no accountant yet: the ledger is empty, not the demo's
  const head = useReadContracts({
    contracts: [
      { address: series.accountant, abi: multiplierAccountantAbi, functionName: 'checkpointCount' },
      { address: series.accountant, abi: multiplierAccountantAbi, functionName: 'pending' },
    ],
    allowFailure: true,
    query: { enabled: !mock, refetchInterval: POLL_MS },
  })
  const headData = head.data as readonly ReadResult[] | undefined
  const count = ok<bigint>(headData, 0)
  const pendingRaw = ok<PendingTuple>(headData, 1)
  const n = count !== undefined ? Number(count) : headData ? PROBE : 0

  const cpContracts = useMemo<ContractFunctionParameters[]>(
    () => Array.from({ length: n }, (_, i) => ({ address: series.accountant, abi: multiplierAccountantAbi, functionName: 'checkpointAt', args: [BigInt(i)] })),
    [n, series.accountant],
  )
  const cps = useReadContracts({ contracts: cpContracts, allowFailure: true, query: { enabled: !mock && n > 0, refetchInterval: POLL_MS } })
  const cpData = cps.data as readonly ReadResult[] | undefined

  return useMemo<Ledger>(() => {
    if (mock) {
      if (preview) return { rows: [], pending: null, events: 0, isLoading: false, isMock: true }
      const { rows, pending } = mockLedger(series.ticker)
      return { rows, pending, events: rows.filter((r) => !r.held).length, isLoading: false, isMock: true }
    }
    const checkpoints = Array.from({ length: n }, (_, i) => ok<Checkpoint>(cpData, i))
    const built = buildLedger(checkpoints, pendingRaw, { probing: count === undefined, now: Date.now() / 1000 })
    return { ...built, isLoading: head.isLoading || (n > 0 && cps.isLoading), isMock: false }
  }, [mock, preview, series.ticker, n, count, cpData, pendingRaw, head.isLoading, cps.isLoading])
}
