'use client'
import Link from 'next/link'
import { useMemo } from 'react'
import { useSeries } from '@/hooks/useSeries'
import { useAllSeriesStats } from '@/hooks/useSeriesStats'
import { WaysCards } from './WaysCards'
import { StatsStrip } from './StatsStrip'

export function Hero() {
  const series = useSeries()
  const { stats } = useAllSeriesStats()
  // "hTopApy" / "hTopLev": the series with the highest fixed APY (JEPI in the prototype).
  const top = useMemo(() => {
    let best = 0
    stats.forEach((s, i) => { if (s.fixedApy > stats[best].fixedApy) best = i })
    return { series: series[best], stats: stats[best], index: best }
  }, [series, stats])

  return (
    <header className="hero">
      <div className="wrap">
        <div className="eyebrow"><i />Live on Robinhood Chain · Open source</div>
        <h1>Lock in a fixed yield on your stock tokens. Or buy the dividends outright.</h1>
        <p>Halve splits a tokenized stock or ETF into two things you can own separately: the share at a discount, and every dividend it pays until a fixed date. Starting with the assets that actually pay.</p>
        <div className="cta"><Link className="btn btn-white btn-lg" href="/app">Start earning</Link><a className="btn btn-line btn-lg" href="#how">See how it works</a></div>
        <WaysCards top={top} />
      </div>
      <StatsStrip />
    </header>
  )
}
