'use client'
import { useCallback } from 'react'
import { parseUnits, type Abi } from 'viem'
import type { Series } from '@/contracts/types'
import { stripVaultAbi } from '@/contracts/abis'
import { useMockPositions } from '@/lib/mockStore'
import { useToast } from '@/lib/toast'
import { quoteRedeemYT } from '@/lib/redeem'
import { isMockSeries } from './useSeries'
import { cleanAmount } from '@/lib/amount'
import { useTx } from './useTx'

/** After maturity: settle() once, then redeemPT(amount) / redeemYT(amount). */
export function useRedeem(series: Series, accrued: number) {
  const mock = isMockSeries(series)
  const { toast } = useToast()
  const { update } = useMockPositions()
  const tx = useTx()
  const t = series.ticker

  const settle = useCallback(async () => {
    if (mock) return toast(`${t} series settled`)
    await tx.run([{ address: series.vault, abi: stripVaultAbi as Abi, functionName: 'settle', args: [], label: 'sending' }], `${t} series settled`)
  }, [mock, series.vault, t, toast, tx])

  const redeem = useCallback(
    async (side: 'pt' | 'yt', input: string) => {
      const a = cleanAmount(input)
      if (!a) return
      const done = side === 'pt' ? `Redeemed ${a.num} p${t} → ${a.num} ${t}` : `Redeemed ${a.num} y${t} → ${quoteRedeemYT(a.num, accrued).out.toFixed(4)} ${t}`
      if (mock) {
        update(t, (p) => (side === 'pt' ? { ...p, pt: Math.max(0, p.pt - a.num) } : { ...p, yt: Math.max(0, p.yt - a.num) }))
        toast(done)
        return
      }
      const amt = parseUnits(a.str, series.decimals)
      await tx.run(
        [{ address: series.vault, abi: stripVaultAbi as Abi, functionName: side === 'pt' ? 'redeemPT' : 'redeemYT', args: [amt], label: 'sending' }],
        done,
      )
    },
    [mock, series, t, accrued, toast, update, tx],
  )

  return { settle, redeem, status: tx.status, busy: tx.busy, txHash: tx.txHash }
}
