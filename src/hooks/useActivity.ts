'use client'
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAccount, usePublicClient } from 'wagmi'
import { parseAbiItem, type Address, type Hash, type PublicClient } from 'viem'
import { SERIES } from '@/contracts/types'
import { POLL_MS } from '@/contracts/constants'
import { BLOCK_TIME_MS } from '@/lib/env'
import { toNumber } from '@/lib/math'
import { useMockPositions } from '@/lib/mockStore'
import { sortActivity, type ActivityAction, type ActivityRow } from '@/lib/activity'
import { CHAIN_ID } from '@/lib/wagmi'
import { isMockSeries } from './useSeries'
import { useIsMounted } from './useIsMounted'

// StripVault events (see contracts/src/StripVault.sol); `account` is indexed so the RPC filters by wallet.
const EV_SPLIT = parseAbiItem('event Split(address indexed account, uint256 amount, uint256 fee, uint256 base)')
const EV_MERGE = parseAbiItem('event Merge(address indexed account, uint256 base, uint256 amount)')
const EV_REDEEM_PT = parseAbiItem('event RedeemPT(address indexed account, uint256 base, uint256 amount)')
const EV_REDEEM_YT = parseAbiItem('event RedeemYT(address indexed account, uint256 base, uint256 amount, uint256 fee)')
const ACTIONS: ActivityAction[] = ['Split', 'Merge', 'Redeem PT', 'Redeem YT']

type Log = { address: Address; blockNumber: bigint | null; transactionHash: Hash | null; args: { amount?: bigint; base?: bigint } }

/** The wallet's Split / Merge / Redeem events across every live vault, newest first (window shrinks if the RPC rejects the range). */
async function fromLogs(client: PublicClient, account: Address): Promise<ActivityRow[]> {
  const live = SERIES.filter((s) => !isMockSeries(s))
  if (live.length === 0) return []
  const byVault = new Map(live.map((s) => [s.vault.toLowerCase(), s]))
  const latest = await client.getBlockNumber()
  const blocksPerDay = BigInt(Math.max(1, Math.round(86_400_000 / BLOCK_TIME_MS)))
  const floor = live.reduce((m, s) => (s.deployBlock != null ? (m == null ? BigInt(s.deployBlock) : m < BigInt(s.deployBlock) ? m : BigInt(s.deployBlock)) : m), null as bigint | null)
  const spans = [90, 30, 7, 1].map((d) => blocksPerDay * BigInt(d))
  for (const span of spans) {
    let from = latest > span ? latest - span : 0n
    if (floor != null && floor > from) from = floor
    try {
      const address = live.map((s) => s.vault)
      const range = { fromBlock: from, toBlock: latest, args: { account } }
      const logs: Log[][] = await Promise.all([
        client.getLogs({ address, event: EV_SPLIT, ...range }),
        client.getLogs({ address, event: EV_MERGE, ...range }),
        client.getLogs({ address, event: EV_REDEEM_PT, ...range }),
        client.getLogs({ address, event: EV_REDEEM_YT, ...range }),
      ])
      const rows: ActivityRow[] = []
      const blocks = new Set<bigint>()
      logs.forEach((list, i) => {
        for (const log of list) {
          const s = byVault.get(log.address.toLowerCase())
          if (!s || log.blockNumber == null) continue
          rows.push({ id: s.id, ticker: s.ticker, action: ACTIONS[i], ts: 0, amount: toNumber(log.args.amount ?? 0n, s.decimals), base: toNumber(log.args.base ?? 0n, s.decimals), txHash: log.transactionHash ?? undefined, block: Number(log.blockNumber) })
          blocks.add(log.blockNumber)
        }
      })
      // timestamps for the newest 60 blocks touched; older rows keep block order without a date
      const recent = [...blocks].sort((x, y) => (x < y ? 1 : -1)).slice(0, 60)
      const ts = new Map(await Promise.all(recent.map(async (b) => [b, Number((await client.getBlock({ blockNumber: b })).timestamp)] as const)))
      for (const r of rows) if (r.block != null) r.ts = ts.get(BigInt(r.block)) ?? 0
      return sortActivity(rows)
    } catch {
      continue
    }
  }
  return []
}

export function useActivity(): { rows: ActivityRow[]; isLoading: boolean; isMock: boolean; connected: boolean } {
  const mounted = useIsMounted()
  const { address, isConnected } = useAccount()
  const connected = mounted && isConnected && !!address
  const client = usePublicClient({ chainId: CHAIN_ID })
  const { log } = useMockPositions()
  const anyLive = useMemo(() => SERIES.some((s) => !isMockSeries(s)), [])
  const q = useQuery({
    queryKey: ['activity', address],
    queryFn: () => fromLogs(client as PublicClient, address as Address),
    enabled: connected && anyLive && !!client,
    refetchInterval: POLL_MS * 5,
    staleTime: POLL_MS,
  })
  return useMemo(() => {
    const mockRows = connected ? sortActivity(log) : []
    const liveRows = q.data ?? []
    return { rows: sortActivity([...liveRows, ...mockRows]), isLoading: connected && anyLive && q.isLoading, isMock: !anyLive, connected }
  }, [connected, log, q.data, q.isLoading, anyLive])
}
