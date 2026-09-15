'use client'
import { useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAccount, useBalance, usePublicClient } from 'wagmi'
import { encodeFunctionData, parseUnits, type Abi, type Address, type PublicClient } from 'viem'
import type { Series } from '@/contracts/types'
import { uniswapV3PoolAbi } from '@/contracts/abis'
import { POLL_MS } from '@/contracts/constants'
import { CHAIN_ID, UNISWAP } from '@/lib/chain'
import { applySlippage, bestQuote, candidateRoutes, encodePath, quoterV2Abi, swapRouter02Abi, type Direction, type Quote, type Route } from '@/lib/buy'
import { ADDRESS_THIS } from '@/lib/limit'
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

/** Best QuoterV2 quote over the candidate routes (null when none of them can fill the amount). */
export async function quoteBest(client: PublicClient, routes: Route[], amountIn: bigint): Promise<Quote | null> {
  const quotes = await Promise.all(routes.map(async (route) => {
    try {
      const { result } = await client.simulateContract({ address: UNISWAP.quoter, abi: quoterV2Abi, functionName: 'quoteExactInput', args: [encodePath(route.tokens, route.fees), amountIn] })
      return { route, amountOut: result[0] }
    } catch { return null }
  }))
  return bestQuote(quotes)
}

async function quoteRoutes(client: PublicClient, series: Series, side: BuySide, payWith: PayWith, direction: Direction, amountIn: bigint): Promise<Quote | null> {
  const token = side === 'pt' ? series.pt : series.yt
  const pool = side === 'pt' ? series.poolPT : series.poolYT
  const poolFee = await client.readContract({ address: pool, abi: uniswapV3PoolAbi, functionName: 'fee' })
  const routes = candidateRoutes(payWith, UNISWAP.weth, series.underlying, token, poolFee, { stock: series.ticker, token: `${side === 'pt' ? 'p' : 'y'}${series.ticker}` }, direction)
  return quoteBest(client, routes, amountIn)
}

/**
 * Market trades on Uniswap v3 through SwapRouter02, quoted by QuoterV2 (the best fee tier wins).
 * Buy: pay with ETH (ETH → stock → token, one transaction) or with the stock (one hop).
 * Sell: token → stock, or token → stock → ETH (the router unwraps WETH in the same transaction).
 */
export function useBuy(series: Series, stats: SeriesStats, side: BuySide, payWith: PayWith, input: string, direction: Direction = 'buy') {
  const mock = isMockSeries(series)
  const { address } = useAccount()
  const client = usePublicClient({ chainId: CHAIN_ID })
  const { toast } = useToast()
  const { update, record } = useMockPositions()
  const tx = useTx()
  const a = cleanAmount(input)
  const sell = direction === 'sell'
  const decimalsIn = sell ? series.decimals : payWith === 'eth' ? 18 : series.decimals
  const decimalsOut = sell ? (payWith === 'eth' ? 18 : series.decimals) : series.decimals
  const amountIn = a ? parseUnits(a.str, decimalsIn) : 0n
  const eth = useBalance({ address, chainId: CHAIN_ID, query: { enabled: !!address && !mock, refetchInterval: POLL_MS } })
  const ethUsd = useMarket().ethUsd ?? MOCK_ETH_USD

  const q = useQuery({
    queryKey: ['buyQuote', series.id, side, payWith, direction, amountIn.toString()],
    queryFn: () => quoteRoutes(client as PublicClient, series, side, payWith, direction, amountIn),
    enabled: !mock && !!client && amountIn > 0n,
    staleTime: POLL_MS,
    refetchInterval: POLL_MS,
  })

  // demo mode: price the trade off the mock pool prices and the ETH price, less the 0.3 % pool fee
  const mockOut = useMemo(() => {
    if (!mock || !a) return 0
    const priceStock = side === 'pt' ? stats.ptPrice : stats.ytPrice // stock per token
    if (sell) {
      const stockOut = a.num * priceStock * 0.997
      return payWith === 'eth' ? (stockOut * stats.usdPrice) / ethUsd : stockOut
    }
    const stockIn = payWith === 'eth' ? (a.num * ethUsd) / stats.usdPrice : a.num
    return priceStock > 0 ? (stockIn / priceStock) * 0.997 : 0
  }, [mock, a, side, payWith, sell, stats, ethUsd])

  const sym = `${side === 'pt' ? 'p' : 'y'}${series.ticker}`
  const counter = payWith === 'eth' ? 'ETH' : series.ticker
  const amountOut = mock ? mockOut : q.data ? toNumber(q.data.amountOut, decimalsOut) : 0
  const label = mock
    ? sell
      ? (payWith === 'eth' ? `${sym} → ${series.ticker} → ETH` : `${sym} → ${series.ticker}`)
      : (payWith === 'eth' ? `ETH → ${series.ticker} → ${sym}` : `${series.ticker} → ${sym}`)
    : q.data?.route.label ?? null
  const noRoute = !mock && amountIn > 0n && !q.isLoading && !q.data

  const trade = useCallback(async () => {
    if (!a || amountIn === 0n) return
    const t = series.ticker
    const done = sell ? `Sold ${a.num} ${sym} for ${amountOut.toFixed(4)} ${counter}` : `Bought ${amountOut.toFixed(4)} ${sym} with ${a.num} ${counter}`
    if (mock) {
      if (sell) update(t, (p) => (side === 'pt' ? { ...p, pt: Math.max(0, p.pt - a.num) } : { ...p, yt: Math.max(0, p.yt - a.num) }))
      else update(t, (p) => (side === 'pt' ? { ...p, pt: p.pt + mockOut } : { ...p, yt: p.yt + mockOut }))
      record({ id: series.id, ticker: t, action: sell ? 'Sell' : 'Buy', ts: Math.floor(Date.now() / 1000), amount: sell ? mockOut : a.num, base: sell ? a.num : mockOut, note: sell ? `${a.num} ${sym} → ${mockOut.toFixed(4)} ${counter}` : `${a.num} ${counter} → ${mockOut.toFixed(4)} ${sym}` })
      toast(done)
      return
    }
    if (!q.data || !address) { toast('No route for this amount yet'); return }
    const minOut = applySlippage(q.data.amountOut)
    const path = encodePath(q.data.route.tokens, q.data.route.fees)
    if (sell) {
      const token = side === 'pt' ? series.pt : series.yt
      const approval = await tx.approvalStep(token, UNISWAP.router, amountIn)
      if (payWith === 'eth') {
        // swap to WETH held by the router, then unwrap to the wallet, in one transaction
        const calls = [
          encodeFunctionData({ abi: swapRouter02Abi, functionName: 'exactInput', args: [{ path, recipient: ADDRESS_THIS, amountIn, amountOutMinimum: minOut }] }),
          encodeFunctionData({ abi: swapRouter02Abi, functionName: 'unwrapWETH9', args: [minOut, address as Address] }),
        ]
        await tx.run([approval, { address: UNISWAP.router, abi: swapRouter02Abi as Abi, functionName: 'multicall', args: [calls], label: 'sending' }], done)
      } else {
        await tx.run([approval, { address: UNISWAP.router, abi: swapRouter02Abi as Abi, functionName: 'exactInput', args: [{ path, recipient: address as Address, amountIn, amountOutMinimum: minOut }], label: 'sending' }], done)
      }
      return
    }
    const params = { path, recipient: address as Address, amountIn, amountOutMinimum: minOut }
    await tx.run(
      [
        payWith === 'stock' ? await tx.approvalStep(series.underlying, UNISWAP.router, amountIn) : null,
        { address: UNISWAP.router, abi: swapRouter02Abi as Abi, functionName: 'exactInput', args: [params], label: 'sending', value: payWith === 'eth' ? amountIn : undefined },
      ],
      done,
    )
  }, [a, amountIn, series, side, sell, sym, counter, mock, update, record, mockOut, payWith, toast, q.data, address, tx, amountOut])

  return {
    amountOut,
    minOut: mock ? amountOut * 0.99 : q.data ? toNumber(applySlippage(q.data.amountOut), decimalsOut) : 0,
    routeLabel: label,
    quoting: !mock && q.isLoading && amountIn > 0n,
    noRoute,
    ethBalance: mock ? MOCK_ETH_BALANCE : eth.data ? Number(eth.data.formatted) : 0,
    ethUsd,
    buy: trade,
    status: tx.status,
    busy: tx.busy,
    txHash: tx.txHash,
  }
}

export const MOCK_ETH_BALANCE = 0.42
