'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAccount, usePublicClient, useReadContracts } from 'wagmi'
import { getAbiItem, parseEventLogs, parseUnits, zeroAddress, type Abi, type Address, type ContractFunctionParameters, type PublicClient } from 'viem'
import type { Series } from '@/contracts/types'
import { uniswapV3PoolAbi } from '@/contracts/abis'
import { POLL_MS } from '@/contracts/constants'
import { applySlippage, encodePath, swapRouter02Abi, FEE_TIERS } from '@/lib/buy'
import { CHAIN_ID, UNISWAP } from '@/lib/chain'
import {
  amountsForLiquidity, encodeClose, expectedFill, fillProgress, getSqrtRatioAtTick, nonfungiblePositionManagerAbi, orderRange, orderStatus,
  priceToTick, spacingForFee, stockPerTokenAt, type OrderRange, type OrderSide, type OrderStatus, type PoolSide,
} from '@/lib/limit'
import { toNumber } from '@/lib/math'
import { MOCK_ETH_USD } from '@/lib/mock'
import { useMockPositions, type MockOrder } from '@/lib/mockStore'
import { ok, type ReadResult } from '@/lib/stats'
import { useToast } from '@/lib/toast'
import type { SeriesStats } from '@/lib/types'
import { cleanAmount } from '@/lib/amount'
import { quoteBest, type BuySide, type PayWith } from './useBuy'
import { useMarket } from './useMarket'
import { isMockSeries } from './useSeries'
import { useTx } from './useTx'

const INCREASE_LIQUIDITY = getAbiItem({ abi: nonfungiblePositionManagerAbi, name: 'IncreaseLiquidity' })

export type Order = {
  key: string
  tokenId: bigint | null // null in demo mode
  token: BuySide
  /** null when the deposit side could not be determined (closing still returns whatever the position holds). */
  side: OrderSide | null
  status: OrderStatus
  /** Fill window in stock per token: the order fills between these, at the limit or better. */
  priceLow: number
  priceHigh: number
  /** What the position holds right now, in human units. */
  amountToken: number
  amountStock: number
  progress: number // 0..1 of the fill
  liquidity: bigint
}

type PoolInfo = PoolSide & { address: Address; token0: Address; fee: number; tick: number; sqrtPriceX96: bigint; current: number }

type Inputs = {
  side: BuySide
  direction: OrderSide
  payWith: PayWith
  amount: string
  price: string
  /** The Trade tab is showing: pool and position reads only run then. */
  active: boolean
  /** Limit chosen (the ETH → stock pre-swap quote only runs then). */
  limit: boolean
}

const RECORDS_KEY = 'halve:orders:v1'
type Record_ = { side: OrderSide; token: BuySide; price: number; amount: number }
function loadRecords(): Record<string, Record_> {
  try { return JSON.parse(localStorage.getItem(RECORDS_KEY) ?? '{}') as Record<string, Record_> } catch { return {} }
}
function saveRecord(tokenId: bigint, r: Record_) {
  try { localStorage.setItem(RECORDS_KEY, JSON.stringify({ ...loadRecords(), [tokenId.toString()]: r })) } catch { /* storage unavailable */ }
}

const MOCK_POOL: PoolSide = { tokenIsToken0: true, tokenDecimals: 18, stockDecimals: 18, spacing: 60 }
const DEADLINE = () => BigInt(Math.floor(Date.now() / 1000) + 20 * 60)

/**
 * Which token each position deposited at mint (its first IncreaseLiquidity). Tries the full range from the
 * series deploy block, then ever shorter windows when the RPC rejects the span; a mint older than the
 * window that finally works stays unknown, which the UI shows as a plain position with a Close button.
 */
async function depositSides(client: PublicClient, ids: bigint[], fromBlock: bigint | 'earliest'): Promise<Record<string, boolean>> {
  const latest = await client.getBlockNumber()
  const spans: (bigint | null)[] = [null, 2_000_000n, 200_000n, 20_000n, 2_000n]
  for (const span of spans) {
    const from = span == null ? fromBlock : latest > span ? latest - span : 0n
    try {
      const logs = await client.getLogs({ address: UNISWAP.npm, event: INCREASE_LIQUIDITY, args: { tokenId: ids }, fromBlock: from, toBlock: latest })
      const sides: Record<string, boolean> = {}
      for (const l of logs) {
        const id = l.args.tokenId?.toString()
        if (id !== undefined && !(id in sides)) sides[id] = (l.args.amount0 ?? 0n) > 0n
      }
      return sides
    } catch { /* range too wide for this RPC: shrink */ }
  }
  return {}
}

/**
 * Limit orders as Uniswap v3 range orders on the PT / YT pools (see lib/limit.ts), placed and closed through
 * the NonfungiblePositionManager. Lists the connected wallet's single-tick positions in both pools with their
 * fill status; the deposit side (buy or sell) comes from a local record written at placement, else from the
 * position's IncreaseLiquidity event.
 */
export function useLimitOrders(series: Series, stats: SeriesStats, input: Inputs) {
  const mock = isMockSeries(series)
  const { address } = useAccount()
  const client = usePublicClient({ chainId: CHAIN_ID })
  const { toast } = useToast()
  const store = useMockPositions()
  const tx = useTx()
  const { ethUsd } = useMarket()
  const owner = address ?? zeroAddress
  const a = cleanAmount(input.amount)
  const price = parseFloat(input.price)
  const [records, setRecords] = useState<Record<string, Record_>>({})
  useEffect(() => { setRecords(loadRecords()) }, [])

  // pools: slot0, token0, fee, tickSpacing for PT and YT
  const poolContracts = useMemo<ContractFunctionParameters[]>(
    () => [series.poolPT, series.poolYT].flatMap((address) => [
      { address, abi: uniswapV3PoolAbi, functionName: 'slot0' },
      { address, abi: uniswapV3PoolAbi, functionName: 'token0' },
      { address, abi: uniswapV3PoolAbi, functionName: 'fee' },
      { address, abi: uniswapV3PoolAbi, functionName: 'tickSpacing' },
    ]),
    [series.poolPT, series.poolYT],
  )
  const poolsQ = useReadContracts({ contracts: poolContracts, allowFailure: true, query: { enabled: !mock && input.active, refetchInterval: POLL_MS } })
  const pools = useMemo<{ pt: PoolInfo | null; yt: PoolInfo | null }>(() => {
    const d = poolsQ.data as readonly ReadResult[] | undefined
    const build = (i: number, token: Address, address: Address): PoolInfo | null => {
      const slot = ok<readonly [bigint, number, ...unknown[]]>(d, i)
      const token0 = ok<Address>(d, i + 1)
      const fee = ok<number>(d, i + 2)
      if (!slot || !token0 || fee === undefined) return null
      const spacing = ok<number>(d, i + 3) ?? spacingForFee(Number(fee))
      const side: PoolSide = { tokenIsToken0: token0.toLowerCase() === token.toLowerCase(), tokenDecimals: series.decimals, stockDecimals: series.decimals, spacing: Number(spacing) }
      const tick = Number(slot[1])
      return { ...side, address, token0, fee: Number(fee), tick, sqrtPriceX96: slot[0], current: stockPerTokenAt(tick, side) }
    }
    return { pt: build(0, series.pt, series.poolPT), yt: build(4, series.yt, series.poolYT) }
  }, [poolsQ.data, series])

  // the pool the inputs refer to (demo: derived from the mock price)
  const pool = useMemo<PoolInfo | null>(() => {
    if (!mock) return input.side === 'pt' ? pools.pt : pools.yt
    const p = input.side === 'pt' ? stats.ptPrice : stats.ytPrice
    if (!(p > 0)) return null
    const tick = Math.floor(priceToTick(p, 18, 18))
    return { ...MOCK_POOL, address: zeroAddress, token0: zeroAddress, fee: 3000, tick, sqrtPriceX96: getSqrtRatioAtTick(tick), current: stockPerTokenAt(tick, MOCK_POOL) }
  }, [mock, input.side, pools, stats.ptPrice, stats.ytPrice])

  const range = useMemo<OrderRange | null>(() => (pool && input.price !== '' ? orderRange(input.direction, price, pool.tick, pool) : null), [pool, input.direction, input.price, price])

  // a limit buy paid in ETH swaps ETH → stock at market first, then the stock waits in the order
  const ethSwapIn = input.direction === 'buy' && input.payWith === 'eth' && a ? parseUnits(a.str, 18) : 0n
  const ethQ = useQuery({
    queryKey: ['limitEthSwap', series.id, ethSwapIn.toString()],
    queryFn: () => quoteBest(client as PublicClient, FEE_TIERS.map((f) => ({ tokens: [UNISWAP.weth, series.underlying], fees: [f], label: `ETH → ${series.ticker} (${f / 10_000}%)` })), ethSwapIn),
    enabled: !mock && !!client && ethSwapIn > 0n && input.active && input.limit,
    staleTime: POLL_MS,
    refetchInterval: POLL_MS,
  })
  const mockEthStock = mock && a && input.payWith === 'eth' && stats.usdPrice > 0 ? (a.num * (ethUsd ?? MOCK_ETH_USD)) / stats.usdPrice : 0
  const depositAmount: number = !a ? 0 : input.direction === 'buy' && input.payWith === 'eth'
    ? mock ? mockEthStock : ethQ.data ? toNumber(applySlippage(ethQ.data.amountOut), series.decimals) : 0
    : a.num
  const expected = range?.ok ? expectedFill(input.direction, depositAmount, range.priceLow, range.priceHigh) : 0

  // ---- the wallet's orders (live): NPM positions in either pool, one tick wide
  const balQ = useReadContracts({
    contracts: [{ address: UNISWAP.npm, abi: nonfungiblePositionManagerAbi, functionName: 'balanceOf', args: [owner] }],
    allowFailure: true,
    query: { enabled: !mock && !!address && input.active, refetchInterval: POLL_MS },
  })
  const count = Number(ok<bigint>(balQ.data as readonly ReadResult[] | undefined, 0) ?? 0n)
  const idContracts = useMemo<ContractFunctionParameters[]>(
    () => Array.from({ length: count }, (_, i) => ({ address: UNISWAP.npm, abi: nonfungiblePositionManagerAbi, functionName: 'tokenOfOwnerByIndex', args: [owner, BigInt(i)] })),
    [count, owner],
  )
  const idsQ = useReadContracts({ contracts: idContracts, allowFailure: true, query: { enabled: !mock && count > 0 && input.active, refetchInterval: POLL_MS } })
  const ids = useMemo(() => Array.from({ length: count }, (_, i) => ok<bigint>(idsQ.data as readonly ReadResult[] | undefined, i)).filter((x): x is bigint => x !== undefined), [idsQ.data, count])
  const posContracts = useMemo<ContractFunctionParameters[]>(
    () => ids.map((id) => ({ address: UNISWAP.npm, abi: nonfungiblePositionManagerAbi, functionName: 'positions', args: [id] })),
    [ids],
  )
  const posQ = useReadContracts({ contracts: posContracts, allowFailure: true, query: { enabled: !mock && ids.length > 0 && input.active, refetchInterval: POLL_MS } })

  type Pos = readonly [bigint, Address, Address, Address, number, number, number, bigint, bigint, bigint, bigint, bigint]
  const candidates = useMemo(() => {
    const d = posQ.data as readonly ReadResult[] | undefined
    const out: { tokenId: bigint; pos: Pos; token: BuySide; pool: PoolInfo }[] = []
    ids.forEach((tokenId, i) => {
      const pos = ok<Pos>(d, i)
      if (!pos) return
      const [, , t0, t1, fee, lower, upper, liquidity, , , owed0, owed1] = pos
      for (const [token, p] of [['pt', pools.pt], ['yt', pools.yt]] as const) {
        if (!p) continue
        const tok = token === 'pt' ? series.pt : series.yt
        const pair = [t0.toLowerCase(), t1.toLowerCase()]
        if (!pair.includes(tok.toLowerCase()) || !pair.includes(series.underlying.toLowerCase())) continue
        if (Number(fee) !== p.fee || upper - lower !== p.spacing) continue
        if (liquidity === 0n && owed0 === 0n && owed1 === 0n) continue
        out.push({ tokenId, pos, token, pool: p })
      }
    })
    return out
  }, [posQ.data, ids, pools, series])

  // deposit side for positions without a local record: the mint's IncreaseLiquidity event
  const unknownIds = useMemo(() => candidates.filter((c) => !records[c.tokenId.toString()]).map((c) => c.tokenId), [candidates, records])
  const sidesQ = useQuery({
    queryKey: ['orderSides', series.id, unknownIds.map(String).join(',')],
    queryFn: () => depositSides(client as PublicClient, unknownIds, series.deployBlock ? BigInt(series.deployBlock) : 'earliest'),
    enabled: !mock && !!client && unknownIds.length > 0 && input.active,
    staleTime: Infinity,
    retry: 1,
  })

  const liveOrders = useMemo<Order[]>(() => candidates.map(({ tokenId, pos, token, pool: p }) => {
    const [, , , , , lower, upper, liquidity, , , owed0, owed1] = pos
    const rec = records[tokenId.toString()]
    const dep0 = rec ? (rec.side === 'buy') === !p.tokenIsToken0 : sidesQ.data?.[tokenId.toString()]
    const side: OrderSide | null = rec ? rec.side : dep0 === undefined ? null : (dep0 === !p.tokenIsToken0 ? 'buy' : 'sell')
    const held = amountsForLiquidity(p.sqrtPriceX96, getSqrtRatioAtTick(lower), getSqrtRatioAtTick(upper), liquidity)
    const amount0 = toNumber(held.amount0 + owed0, p.tokenIsToken0 ? p.tokenDecimals : p.stockDecimals)
    const amount1 = toNumber(held.amount1 + owed1, p.tokenIsToken0 ? p.stockDecimals : p.tokenDecimals)
    const edges = [stockPerTokenAt(lower, p), stockPerTokenAt(upper, p)]
    const status = dep0 === undefined ? (liquidity === 0n ? 'filled' : 'open') : orderStatus(lower, upper, dep0, p.tick)
    return {
      key: tokenId.toString(), tokenId, token, side, status,
      priceLow: Math.min(...edges), priceHigh: Math.max(...edges),
      amountToken: p.tokenIsToken0 ? amount0 : amount1, amountStock: p.tokenIsToken0 ? amount1 : amount0,
      progress: side ? fillProgress(side, p.tokenIsToken0, amount0, amount1) : 0,
      liquidity,
    }
  }), [candidates, records, sidesQ.data])

  const mockOrders = useMemo<Order[]>(() => store.orders.filter((o) => o.ticker === series.ticker).map((o) => {
    const p = o.token === 'pt' ? stats.ptPrice : stats.ytPrice
    const cur = Math.floor(priceToTick(p, 18, 18))
    const r = orderRange(o.side, o.price, cur, MOCK_POOL)
    return {
      key: o.id, tokenId: null, token: o.token, side: o.side, status: 'open' as const,
      priceLow: r.priceLow || o.price, priceHigh: r.priceHigh || o.price,
      amountToken: o.side === 'sell' ? o.amount : 0, amountStock: o.side === 'buy' ? o.amount : 0, progress: 0, liquidity: 0n,
    }
  }), [store.orders, series.ticker, stats.ptPrice, stats.ytPrice])

  const place = useCallback(async () => {
    if (!a || !pool || !range?.ok) return
    const sym = `${input.side === 'pt' ? 'p' : 'y'}${series.ticker}`
    const t = series.ticker
    const what = input.direction === 'buy' ? `Buy ${sym} at ≤ ${range.priceHigh.toFixed(4)} ${t}` : `Sell ${a.num} ${sym} at ≥ ${range.priceLow.toFixed(4)} ${t}`
    if (mock) {
      if (input.direction === 'sell') store.update(t, (p) => (input.side === 'pt' ? { ...p, pt: Math.max(0, p.pt - a.num) } : { ...p, yt: Math.max(0, p.yt - a.num) }))
      const o: MockOrder = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, ticker: t, token: input.side, side: input.direction, price, amount: depositAmount, ts: Math.floor(Date.now() / 1000) }
      store.addOrder(o)
      store.record({ id: series.id, ticker: t, action: 'Limit order', ts: o.ts, amount: input.direction === 'buy' ? depositAmount : 0, base: input.direction === 'sell' ? a.num : 0, note: what })
      toast(`Order placed: ${what}`)
      return
    }
    if (!address || !client) return
    const token = input.side === 'pt' ? series.pt : series.yt
    let deposit: bigint
    if (input.direction === 'buy' && input.payWith === 'eth') {
      if (!ethQ.data) { toast('No ETH route yet'); return }
      const minOut = applySlippage(ethQ.data.amountOut)
      const swap = await tx.run([{ address: UNISWAP.router, abi: swapRouter02Abi as Abi, functionName: 'exactInput', args: [{ path: encodePath(ethQ.data.route.tokens, ethQ.data.route.fees), recipient: address, amountIn: ethSwapIn, amountOutMinimum: minOut }], label: 'sending', value: ethSwapIn }], `Swapped ${a.num} ETH to ${t}`)
      if (!swap) return
      deposit = minOut
    } else {
      deposit = parseUnits(a.str, series.decimals)
    }
    const depositToken = input.direction === 'buy' ? series.underlying : token
    const t0 = pool.token0
    const t1 = pool.token0.toLowerCase() === token.toLowerCase() ? series.underlying : token
    const dep0 = range.depositIsToken0
    const params = {
      token0: t0, token1: t1, fee: pool.fee, tickLower: range.tickLower, tickUpper: range.tickUpper,
      amount0Desired: dep0 ? deposit : 0n, amount1Desired: dep0 ? 0n : deposit,
      amount0Min: dep0 ? (deposit * 99n) / 100n : 0n, amount1Min: dep0 ? 0n : (deposit * 99n) / 100n, // reverts if the price moved into the range meanwhile
      recipient: address, deadline: DEADLINE(),
    }
    const rc = await tx.run(
      [await tx.approvalStep(depositToken, UNISWAP.npm, deposit), { address: UNISWAP.npm, abi: nonfungiblePositionManagerAbi as Abi, functionName: 'mint', args: [params], label: 'sending' }],
      `Order placed: ${what}`,
    )
    if (rc) {
      const minted = parseEventLogs({ abi: nonfungiblePositionManagerAbi, eventName: 'Transfer', logs: rc.logs }).find((l) => l.args.from === zeroAddress)
      if (minted?.args.tokenId !== undefined) {
        saveRecord(minted.args.tokenId, { side: input.direction, token: input.side, price, amount: depositAmount })
        setRecords(loadRecords())
      }
    }
  }, [a, pool, range, input, series, mock, store, price, depositAmount, toast, address, client, ethQ.data, tx, ethSwapIn])

  const close = useCallback(async (o: Order) => {
    const sym = `${o.token === 'pt' ? 'p' : 'y'}${series.ticker}`
    const t = series.ticker
    const what = o.status === 'filled' ? `Claimed ${o.side === 'buy' ? `${o.amountToken.toFixed(4)} ${sym}` : `${o.amountStock.toFixed(4)} ${t}`}` : o.status === 'partial' ? `Closed: ${o.amountToken.toFixed(4)} ${sym} + ${o.amountStock.toFixed(4)} ${t} returned` : `Order cancelled`
    if (mock) {
      if (o.side === 'sell') store.update(t, (p) => (o.token === 'pt' ? { ...p, pt: p.pt + o.amountToken } : { ...p, yt: p.yt + o.amountToken }))
      store.removeOrder(o.key)
      store.record({ id: series.id, ticker: t, action: 'Order closed', ts: Math.floor(Date.now() / 1000), amount: o.amountStock, base: o.amountToken, note: what })
      toast(what)
      return
    }
    if (!address || o.tokenId === null) return
    await tx.run([{ address: UNISWAP.npm, abi: nonfungiblePositionManagerAbi as Abi, functionName: 'multicall', args: [encodeClose(o.tokenId, o.liquidity, address, DEADLINE())], label: 'sending' }], what)
  }, [series, mock, store, toast, address, tx])

  return {
    pool: pool ? { current: pool.current, spacing: pool.spacing, ready: true } : null,
    range,
    expected,
    depositAmount,
    ethQuoting: !mock && ethQ.isLoading && ethSwapIn > 0n,
    ethNoRoute: !mock && ethSwapIn > 0n && !ethQ.isLoading && !ethQ.data,
    orders: mock ? mockOrders : liveOrders,
    ordersLoading: !mock && !!address && (balQ.isLoading || (count > 0 && (idsQ.isLoading || posQ.isLoading))),
    place,
    close,
    status: tx.status,
    busy: tx.busy,
    txHash: tx.txHash,
  }
}

