'use client'
import { useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAccount, useBalance, usePublicClient } from 'wagmi'
import { parseUnits, type Abi, type Address, type PublicClient } from 'viem'
import type { Series } from '@/contracts/types'
import { uniswapV3PoolAbi } from '@/contracts/abis'
import { POLL_MS } from '@/contracts/constants'
import { CHAIN_ID, UNISWAP } from '@/lib/chain'
import { applySlippage, bestQuote, candidateRoutes, encodePath, quoterV2Abi, swapRouter02Abi, type Quote } from '@/lib/buy'
import { toNumber } from '@/lib/math'
import { MOCK_ETH_USD } from '@/lib/mock'
import { useMockPositions } from '@/lib/mockStore'
import { useToast } from '@/lib/toast'
import type { SeriesStats } from '@/lib/types'
import { cleanAmount } from '@/lib/amount'
import { useMarket } from './useMarket'
import { isMockSeries } from './useSeries'
import { useTx } from './useTx'

export type PayWith = 'eth' | 'stock'
export type BuySide = 'pt' | 'yt'

async function quoteRoutes(client: PublicClient, series: Series, side: BuySide, payWith: PayWith, amountIn: bigint): Promise<Quote | null> {
  const token = side === 'pt' ? series.pt : series.yt
  const pool = side === 'pt' ? series.poolPT : series.poolYT
  const poolFee = await client.readContract({ address: pool, abi: uniswapV3PoolAbi, functionName: 'fee' })
  const routes = candidateRoutes(payWith, UNISWAP.weth, series.underlying, token, poolFee, { stock: series.ticker, token: `${side === 'pt' ? 'p' : 'y'}${series.ticker}` })
  const quotes = await Promise.all(routes.map(async (route) => {
    try {
      const { result } = await client.simulateContract({ address: UNISWAP.quoter, abi: quoterV2Abi, functionName: 'quoteExactInput', args: [encodePath(route.tokens, route.fees), amountIn] })
      return { route, amountOut: result[0] }
    } catch { return null }
  }))
  return bestQuote(quotes)
}

/**
 * Buy PT or YT on Uniswap v3, paying with ETH (ETH → stock → token, one transaction through SwapRouter02) or
 * with the stock token (one hop). Quotes come from QuoterV2; the best fee tier wins.
 */
export function useBuy(series: Series, stats: SeriesStats, side: BuySide, payWith: PayWith, input: string) {
  const mock = isMockSeries(series)
  const { address } = useAccount()
  const client = usePublicClient({ chainId: CHAIN_ID })
  const { toast } = useToast()
  const { update, record } = useMockPositions()
  const tx = useTx()
  const a = cleanAmount(input)
  const decimalsIn = payWith === 'eth' ? 18 : series.decimals
  const amountIn = a ? parseUnits(a.str, decimalsIn) : 0n
  const eth = useBalance({ address, chainId: CHAIN_ID, query: { enabled: !!address && !mock, refetchInterval: POLL_MS } })
  const ethUsd = useMarket().ethUsd ?? MOCK_ETH_USD

  const q = useQuery({
    queryKey: ['buyQuote', series.id, side, payWith, amountIn.toString()],
    queryFn: () => quoteRoutes(client as PublicClient, series, side, payWith, amountIn),
    enabled: !mock && !!client && amountIn > 0n,
    staleTime: POLL_MS,
    refetchInterval: POLL_MS,
  })

  // demo mode: price the trade off the mock pool prices and a fixed ETH price
  const mockOut = useMemo(() => {
    if (!mock || !a) return 0
    const priceStock = side === 'pt' ? stats.ptPrice : stats.ytPrice // stock per token
    const stockIn = payWith === 'eth' ? (a.num * ethUsd) / stats.usdPrice : a.num
    return priceStock > 0 ? (stockIn / priceStock) * 0.997 : 0 // 0.3 % pool fee
  }, [mock, a, side, payWith, stats, ethUsd])

  const amountOut = mock ? mockOut : q.data ? toNumber(q.data.amountOut, series.decimals) : 0
  const label = mock ? (payWith === 'eth' ? `ETH → ${series.ticker} → ${side === 'pt' ? 'p' : 'y'}${series.ticker}` : `${series.ticker} → ${side === 'pt' ? 'p' : 'y'}${series.ticker}`) : q.data?.route.label ?? null
  const noRoute = !mock && amountIn > 0n && !q.isLoading && !q.data

  const buy = useCallback(async () => {
    if (!a || amountIn === 0n) return
    const t = series.ticker
    const sym = `${side === 'pt' ? 'p' : 'y'}${t}`
    if (mock) {
      update(t, (p) => (side === 'pt' ? { ...p, pt: p.pt + mockOut } : { ...p, yt: p.yt + mockOut }))
      record({ id: series.id, ticker: t, action: 'Buy', ts: Math.floor(Date.now() / 1000), amount: a.num, base: mockOut, note: `${a.num} ${payWith === 'eth' ? 'ETH' : t} → ${mockOut.toFixed(4)} ${sym}` })
      toast(`Bought ${mockOut.toFixed(4)} ${sym} with ${a.num} ${payWith === 'eth' ? 'ETH' : t}`)
      return
    }
    if (!q.data || !address) { toast('No route for this amount yet'); return }
    const params = { path: encodePath(q.data.route.tokens, q.data.route.fees), recipient: address as Address, amountIn, amountOutMinimum: applySlippage(q.data.amountOut) }
    await tx.run(
      [
        payWith === 'stock' ? await tx.approvalStep(series.underlying, UNISWAP.router, amountIn) : null,
        { address: UNISWAP.router, abi: swapRouter02Abi as Abi, functionName: 'exactInput', args: [params], label: 'sending', value: payWith === 'eth' ? amountIn : undefined },
      ],
      `Bought ${amountOut.toFixed(4)} ${sym} with ${a.num} ${payWith === 'eth' ? 'ETH' : t}`,
    )
  }, [a, amountIn, series, side, mock, update, record, mockOut, payWith, toast, q.data, address, tx, amountOut])

  return {
    amountOut,
    minOut: mock ? amountOut * 0.99 : q.data ? toNumber(applySlippage(q.data.amountOut), series.decimals) : 0,
    routeLabel: label,
    quoting: !mock && q.isLoading && amountIn > 0n,
    noRoute,
    ethBalance: mock ? MOCK_ETH_BALANCE : eth.data ? Number(eth.data.formatted) : 0,
    buy,
    status: tx.status,
    busy: tx.busy,
    txHash: tx.txHash,
  }
}

export const MOCK_ETH_BALANCE = 0.42
