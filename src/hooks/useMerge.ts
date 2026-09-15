'use client'
import { useCallback } from 'react'
import { parseUnits, type Abi } from 'viem'
import type { Series } from '@/contracts/types'
import { stripVaultAbi } from '@/contracts/abis'
import { useMockPositions } from '@/lib/mockStore'
import { useToast } from '@/lib/toast'
import { isMockSeries } from './useSeries'
import { cleanAmount } from '@/lib/amount'
import { useTx } from './useTx'

/**
 * approve PT + approve YT (if needed) → StripVault.merge(amount). Fee 0.
 * Never gated by pool liquidity or series state — the vault decides, not the UI.
 */
export function useMerge(series: Series) {
  const mock = isMockSeries(series)
  const { toast } = useToast()
  const { update, record } = useMockPositions()
  const tx = useTx()

  const merge = useCallback(
    async (input: string) => {
      const a = cleanAmount(input)
      if (!a) return
      const t = series.ticker
      const done = `Merged into ${a.num} ${t}`
      if (mock) {
        update(t, (p) => ({ ...p, pt: Math.max(0, p.pt - a.num), yt: Math.max(0, p.yt - a.num) }))
        record({ id: series.id, ticker: t, action: 'Merge', ts: Math.floor(Date.now() / 1000), amount: a.num, base: a.num })
        toast(done)
        return
      }
      const amt = parseUnits(a.str, series.decimals)
      await tx.run(
        [
          await tx.approvalStep(series.pt, series.vault, amt),
          await tx.approvalStep(series.yt, series.vault, amt),
          { address: series.vault, abi: stripVaultAbi as Abi, functionName: 'merge', args: [amt], label: 'sending' },
        ],
        done,
      )
    },
    [mock, series, toast, update, record, tx],
  )

  return { merge, status: tx.status, busy: tx.busy, txHash: tx.txHash }
}
