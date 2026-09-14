'use client'
import { useCallback, useState } from 'react'
import { useAccount, usePublicClient, useWriteContract } from 'wagmi'
import { useQueryClient } from '@tanstack/react-query'
import { parseUnits, type Address } from 'viem'
import type { Series } from '@/contracts/types'
import { erc20Abi, stripVaultAbi } from '@/contracts/abis'
import { CHAIN_ID } from '@/lib/wagmi'
import { useMockPositions } from '@/lib/mockStore'
import { shortError, useToast } from '@/lib/toast'
import type { TxStatus } from '@/lib/types'
import { isMockSeries } from './useSeries'
import { cleanAmount } from './useSplit'

/**
 * approve PT + approve YT (if needed) → StripVault.merge(amount). Fee 0.
 * Never gated by pool liquidity or series state — the vault decides, not the UI.
 */
export function useMerge(series: Series) {
  const mock = isMockSeries(series)
  const { address } = useAccount()
  const publicClient = usePublicClient({ chainId: CHAIN_ID })
  const { writeContractAsync } = useWriteContract()
  const qc = useQueryClient()
  const { toast } = useToast()
  const { update } = useMockPositions()
  const [status, setStatus] = useState<TxStatus>('idle')

  const merge = useCallback(
    async (input: string) => {
      const a = cleanAmount(input)
      if (!a) return
      const t = series.ticker
      const done = `Merged into ${a.num} ${t}`
      if (mock) {
        update(t, (p) => ({ ...p, pt: Math.max(0, p.pt - a.num), yt: Math.max(0, p.yt - a.num) }))
        toast(done)
        return
      }
      if (!address || !publicClient) return toast('Connect wallet')
      try {
        const amt = parseUnits(a.str, series.decimals)
        const approveIfNeeded = async (token: Address) => {
          const allowance = await publicClient.readContract({ address: token, abi: erc20Abi, functionName: 'allowance', args: [address, series.vault] })
          if (allowance >= amt) return
          setStatus('approving')
          const h = await writeContractAsync({ address: token, abi: erc20Abi, functionName: 'approve', args: [series.vault, amt], chainId: CHAIN_ID })
          const r = await publicClient.waitForTransactionReceipt({ hash: h })
          if (r.status !== 'success') throw new Error('Approval reverted')
        }
        await approveIfNeeded(series.pt)
        await approveIfNeeded(series.yt)
        setStatus('sending')
        const hash = await writeContractAsync({ address: series.vault, abi: stripVaultAbi, functionName: 'merge', args: [amt], chainId: CHAIN_ID })
        setStatus('confirming')
        const rc = await publicClient.waitForTransactionReceipt({ hash })
        if (rc.status !== 'success') throw new Error('Merge reverted')
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

  return { merge, status, busy: status !== 'idle' }
}
