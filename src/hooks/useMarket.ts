'use client'
import { useQuery } from '@tanstack/react-query'
import { MARKET_OFF, type MarketData } from '@/lib/market'

export type Market = MarketData & { preview: boolean }
const OFF: Market = { ...MARKET_OFF, preview: false }

/**
 * /api/market, refreshed every minute: real share prices and trailing yields for the preview overlay,
 * the USD fallback for live series without a feed, and the ETH price for the demo Buy quote.
 * `preview` is true once at least one quote is in, i.e. demo series switch to live numbers.
 */
export function useMarket(): Market {
  const q = useQuery({
    queryKey: ['market'],
    queryFn: async (): Promise<MarketData> => {
      const r = await fetch('/api/market', { cache: 'no-store' })
      if (!r.ok) throw new Error(`market HTTP ${r.status}`)
      return r.json()
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: 1,
  })
  const d = q.data
  if (!d || !d.ok) return OFF
  return { ...d, preview: Object.keys(d.quotes).length > 0 }
}
