'use client'
import { useCallback, useState } from 'react'
import { useAccount, usePublicClient, useWriteContract } from 'wagmi'
import { useQueryClient } from '@tanstack/react-query'
import { parseUnits } from 'viem'
import type { Series } from '@/contracts/types'
import { erc20Abi, stripVaultAbi } from '@/contracts/abis'
import { SPLIT_FEE } from '@/contracts/constants'
import { CHAIN_ID } from '@/lib/wagmi'
import { useMockPositions } from '@/lib/mockStore'
import { shortError, useToast } from '@/lib/toast'
import type { TxStatus } from '@/lib/types'
import { isMockSeries } from './useSeries'

/** "1." → "1", ".5" → "0.5"; returns null when not a positive decimal. */
export function cleanAmount(input: string): { str: string; num: number } | null {
  const s = input.trim().replace(/^\./, '0.').replace(/\.$/, '')
  if (!/^\d+(\.\d+)?$/.test(s)) return null
  const num = parseFloat(s)
  return num > 0 ? { str: s, num } : null
}

/** approve(vault) if needed → StripVault.split(amount). Mock mode updates the in-memory position. */
export function useSplit(series: Series) {
  const mock = isMockSeries(series)
  const { address } = useAccount()
  const publicClient = usePublicClient({ chainId: CHAIN_ID })
  const { writeContractAsync } = useWriteContract()
  const qc = useQueryClient()
  const { toast } = useToast()
  const { update } = useMockPositions()
  const [status, setStatus] = useState<TxStatus>('idle')

  const split = useCallback(
    async (input: string) => {
      const a = cleanAmount(input)
      if (!a) return
      const t = series.ticker
      const done = `Split ${a.num} ${t} → p${t} + y${t}`
      if (mock) {
        update(t, (p) => ({ ...p, pt: p.pt + a.num * (1 - SPLIT_FEE), yt: p.yt + a.num * (1 - SPLIT_FEE) }))
        toast(done)
        return
      }
      if (!address || !publicClient) return toast('Connect wallet')
      try {
        const amt = parseUnits(a.str, series.decimals)
        const allowance = await publicClient.readContract({ address: series.underlying, abi: erc20Abi, functionName: 'allowance', args: [address, series.vault] })
        if (allowance < amt) {
          setStatus('approving')
          const h = await writeContractAsync({ address: series.underlying, abi: erc20Abi, functionName: 'approve', args: [series.vault, amt], chainId: CHAIN_ID })
          const r = await publicClient.waitForTransactionReceipt({ hash: h })
          if (r.status !== 'success') throw new Error('Approval reverted')
        }
        setStatus('sending')
        const hash = await writeContractAsync({ address: series.vault, abi: stripVaultAbi, functionName: 'split', args: [amt], chainId: CHAIN_ID })
        setStatus('confirming')
        const rc = await publicClient.waitForTransactionReceipt({ hash })
        if (rc.status !== 'success') throw new Error('Split reverted')
        setStatus('done')
        toast(done)
        void qc.invalidateQueries()
      } catch (e) {
        setStatus('error')
        toast(shortError(e))
      } finally {
        setStatus('idle')
      }
    },
    [mock, series, address, publicClient, writeContractAsync, qc, toast, update],
  )

  return { split, status, busy: status !== 'idle' }
}
