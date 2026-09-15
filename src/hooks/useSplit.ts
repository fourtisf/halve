'use client'
import { useCallback } from 'react'
import { parseUnits, type Abi } from 'viem'
import type { Series } from '@/contracts/types'
import { stripVaultAbi } from '@/contracts/abis'
import { SPLIT_FEE } from '@/contracts/constants'
import { useMockPositions } from '@/lib/mockStore'
import { useToast } from '@/lib/toast'
import { isMockSeries } from './useSeries'
import { useTx } from './useTx'
import { cleanAmount } from '@/lib/amount'

export { cleanAmount } from '@/lib/amount'

/** approve(vault) if needed → StripVault.split(amount). Mock mode updates the in-memory position. */
export function useSplit(series: Series) {
  const mock = isMockSeries(series)
  const { toast } = useToast()
  const { update, record } = useMockPositions()
  const tx = useTx()

  const split = useCallback(
    async (input: string) => {
      const a = cleanAmount(input)
      if (!a) return
      const t = series.ticker
      const done = `Split ${a.num} ${t} → p${t} + y${t}`
      if (mock) {
        update(t, (p) => ({ ...p, pt: p.pt + a.num * (1 - SPLIT_FEE), yt: p.yt + a.num * (1 - SPLIT_FEE) }))
        record({ id: series.id, ticker: t, action: 'Split', ts: Math.floor(Date.now() / 1000), amount: a.num, base: a.num * (1 - SPLIT_FEE) })
        toast(done)
        return
      }
      const amt = parseUnits(a.str, series.decimals)
      await tx.run(
        [
          await tx.approvalStep(series.underlying, series.vault, amt),
          { address: series.vault, abi: stripVaultAbi as Abi, functionName: 'split', args: [amt], label: 'sending' },
        ],
        done,
      )
    },
    [mock, series, toast, update, record, tx],
  )

  return { split, status: tx.status, busy: tx.busy, txHash: tx.txHash }
}
