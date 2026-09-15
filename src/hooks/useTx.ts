'use client'
import { useCallback, useState } from 'react'
import { useAccount, usePublicClient, useWriteContract } from 'wagmi'
import { useQueryClient } from '@tanstack/react-query'
import type { Abi, Address, Hash, TransactionReceipt } from 'viem'
import { erc20Abi } from '@/contracts/abis'
import { CHAIN_ID } from '@/lib/wagmi'
import { invalidateChainReads } from '@/lib/queries'
import { shortError, useToast } from '@/lib/toast'
import type { TxStatus } from '@/lib/types'

export type Step = { address: Address; abi: Abi; functionName: string; args: readonly unknown[]; label: 'approving' | 'sending'; value?: bigint }

/** Shared approve-then-call runner used by useSplit / useMerge / useRedeem. */
export function useTx() {
  const { address } = useAccount()
  const publicClient = usePublicClient({ chainId: CHAIN_ID })
  const { writeContractAsync } = useWriteContract()
  const qc = useQueryClient()
  const { toast } = useToast()
  const [status, setStatus] = useState<TxStatus>('idle')
  const [txHash, setTxHash] = useState<Hash | null>(null)

  /** approve(spender, amount) only when the current allowance is short. */
  const approvalStep = useCallback(
    async (token: Address, spender: Address, amount: bigint): Promise<Step | null> => {
      if (!address || !publicClient) return null
      const allowance = await publicClient.readContract({ address: token, abi: erc20Abi, functionName: 'allowance', args: [address, spender] })
      if (allowance >= amount) return null
      return { address: token, abi: erc20Abi as Abi, functionName: 'approve', args: [spender, amount], label: 'approving' }
    },
    [address, publicClient],
  )

  const run = useCallback(
    async (steps: (Step | null)[], onDone: string): Promise<TransactionReceipt | null> => {
      if (!address || !publicClient) { toast('Connect wallet'); return null }
      setTxHash(null)
      let last: TransactionReceipt | null = null
      try {
        for (const step of steps) {
          if (!step) continue
          setStatus(step.label)
          const hash = await writeContractAsync({ address: step.address, abi: step.abi, functionName: step.functionName, args: step.args, chainId: CHAIN_ID, value: step.value })
          setTxHash(hash)
          setStatus('confirming')
          const rc = await publicClient.waitForTransactionReceipt({ hash })
          if (rc.status !== 'success') throw new Error(`${step.functionName} reverted`)
          last = rc
        }
        setStatus('done')
        toast(onDone)
        invalidateChainReads(qc)
        return last
      } catch (e) {
        setStatus('error')
        toast(shortError(e))
        return null
      } finally {
        setStatus('idle')
      }
    },
    [address, publicClient, writeContractAsync, qc, toast],
  )

  return { run, approvalStep, status, txHash, busy: status !== 'idle' }
}
