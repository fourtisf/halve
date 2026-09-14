'use client'
import { useMemo } from 'react'
import { useReadContracts } from 'wagmi'
import type { ContractFunctionParameters } from 'viem'
import type { Series } from '@/contracts/types'
import { multiplierAccountantAbi } from '@/contracts/abis'
import { GUARDIAN_TIMELOCK_SECONDS, POLL_MS, WAD } from '@/contracts/constants'
import { mockLedger } from '@/lib/mock'
import { classifyRatio, wadToNumber } from '@/lib/math'
import type { Ledger, LedgerEvent, LedgerRow } from '@/lib/types'
import { isMockSeries } from './useSeries'
import { ok, type ReadResult } from './readResult'

const KIND: Record<number, LedgerEvent> = { 0: 'Dividend', 1: 'Split', 2: 'Special dividend' }
const PROBE = 32 // if checkpointCount() is absent, probe checkpointAt(0..31) and stop at the first revert

type Checkpoint = readonly [bigint, number, bigint, bigint]
type Pending = readonly [boolean, bigint, bigint, bigint]

/** Dividend ledger: checkpointAt(i) for i in 0..n, newest first; pending() rendered as a held row. */
export function useLedger(series: Series): Ledger {
  const mock = isMockSeries(series)
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
  const pendingRaw = ok<Pending>(headData, 1)
  const n = count !== undefined ? Number(count) : headData ? PROBE : 0

  const cpContracts = useMemo<ContractFunctionParameters[]>(
    () => Array.from({ length: n }, (_, i) => ({ address: series.accountant, abi: multiplierAccountantAbi, functionName: 'checkpointAt', args: [BigInt(i)] })),
    [n, series.accountant],
  )
  const cps = useReadContracts({ contracts: cpContracts, allowFailure: true, query: { enabled: !mock && n > 0, refetchInterval: POLL_MS } })
  const cpData = cps.data as readonly ReadResult[] | undefined

  return useMemo<Ledger>(() => {
    if (mock) {
      const { rows, pending } = mockLedger(series.ticker)
      return { rows, pending, events: rows.filter((r) => !r.held).length, isLoading: false, isMock: true }
    }
    const rows: LedgerRow[] = []
    for (let i = 0; i < n; i++) {
      const cp = ok<Checkpoint>(cpData, i)
      if (!cp) {
        if (count === undefined) break // probing: first revert ends the list
        continue
      }
      rows.push({ ts: Number(cp[0]), event: KIND[cp[1]] ?? 'Unclassified', ratio: wadToNumber(cp[2]), indexAfter: wadToNumber(cp[3]), held: false })
    }
    rows.sort((a, b) => b.ts - a.ts)
    let pending: LedgerRow | null = null
    if (pendingRaw && pendingRaw[0]) {
      const [, ts, oldM, newM] = pendingRaw
      const ratio = oldM > 0n ? Number((newM * WAD) / oldM) / 1e18 : 0
      pending = {
        ts: Number(ts),
        event: classifyRatio(ratio),
        ratio,
        indexAfter: null,
        held: true,
        timelockRemaining: Math.max(0, Number(ts) + GUARDIAN_TIMELOCK_SECONDS - Date.now() / 1000),
      }
    }
    return {
      rows: pending ? [pending, ...rows] : rows,
      pending,
      events: rows.length,
      isLoading: head.isLoading || (n > 0 && cps.isLoading),
      isMock: false,
    }
  }, [mock, series.ticker, n, count, cpData, pendingRaw, head.isLoading, cps.isLoading])
}
