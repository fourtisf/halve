'use client'
import Link from 'next/link'
import type { Series } from '@/contracts/types'
import type { SeriesStats } from '@/lib/types'
import { f } from '@/lib/format'

const MONTH_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export function WaysCards({ top }: { top: { series: Series; stats: SeriesStats; index: number } }) {
  const { series: s, stats: st, index } = top
  const t = s.ticker
  const d = new Date(s.maturity * 1000)
  const maturityLong = `${MONTH_LONG[d.getUTCMonth()]} ${d.getUTCFullYear()}`
  const apy = st.ready ? f(st.fixedApy * 100, 1) + '%' : '—'
  const lev = st.ready ? Math.round(st.leverage) + '×' : '—'
  const ytPct = st.ready ? f(st.ytPrice * 100, 1) + '%' : '—'
  return (
    <div className="ways">
      <div className="way">
        <div className="k">If you want safety · best series today: {t}</div>
        <div className="big" id="hTopApy">{apy}<small> fixed APY</small></div>
        <h3>Buy the share, skip the dividends</h3>
        <p>Buy the PT at a discount, hold it until {maturityLong}, redeem the full share. No dividends, no surprises — the discount you buy at is your yield, locked on day one.</p>
        <div className="act"><Link className="btn btn-white btn-sm" href={`/app?s=${index}`}>Buy PT</Link><Link className="btn btn-line btn-sm" href="/lend">Use as collateral</Link></div>
      </div>
      <div className="way yt">
        <div className="k">If you want upside · best series today: {t}</div>
        <div className="big y" id="hTopLev">{lev}<small> dividend exposure</small></div>
        <h3>Own the dividends, nothing else</h3>
        <p>The YT costs {ytPct} of the share and collects every payout until maturity. A rate cut or a special dividend reprices it hard. No leverage, no liquidation.</p>
        <div className="act"><Link className="btn btn-white btn-sm" href={`/app?s=${index}&side=yt`}>Buy YT</Link></div>
      </div>
    </div>
  )
}
