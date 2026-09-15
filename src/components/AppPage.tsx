'use client'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useBlockNumber } from 'wagmi'
import { AppShell } from './AppShell'
import { SeriesSelector } from './SeriesSelector'
import { KPIs } from './KPIs'
import { YtChart } from './YtChart'
import { DividendLedger } from './DividendLedger'
import { ActionPanel, type Mode } from './ActionPanel'
import { Position } from './Position'
import { Portfolio } from './Portfolio'
import { Activity } from './Activity'
import { Banner, RPC_ERROR_TEXT } from './Skeleton'
import { useSeriesAt } from '@/hooks/useSeries'
import { useAllSeriesStats } from '@/hooks/useSeriesStats'
import { useLedger } from '@/hooks/useLedger'
import { usePosition } from '@/hooks/usePosition'
import { useYtHistory } from '@/hooks/useYtHistory'
import { MOCK } from '@/lib/env'
import { fmtInt, monthYear } from '@/lib/format'
import { MOCK_START_BLOCK, mockStats } from '@/lib/mock'
import { CHAIN_ID } from '@/lib/wagmi'

/** "block 4,812,337" — live block number, or the prototype's ticking counter in MOCK mode. */
function BlockLabel() {
  const { data } = useBlockNumber({ chainId: CHAIN_ID, watch: !MOCK, query: { enabled: !MOCK } })
  const [mockBlock, setMockBlock] = useState(MOCK_START_BLOCK)
  useEffect(() => {
    if (!MOCK) return
    const id = setInterval(() => setMockBlock((b) => b + 1), 2500)
    return () => clearInterval(id)
  }, [])
  const n = MOCK ? mockBlock : data
  return <span id="blk">{n != null ? `block ${fmtInt(n)}` : 'block —'}</span>
}

/** Buy is the default view; ?tab= picks the others. Portfolio keeps whatever the panel was showing. */
const modeFor = (tab: string | null): Mode => (tab === 'earn' ? 'earn' : tab === 'split' ? 'split' : tab === 'merge' ? 'merge' : 'buy')

/** /app — mirrors the prototype's #p-app page and its ?s=&side=&tab= params. */
export function AppPage() {
  const params = useSearchParams()
  const router = useRouter()
  const sParam = params.get('s')
  const tab = params.get('tab')
  const side = params.get('side')
  const { series, index } = useSeriesAt(sParam == null ? 1 : Number(sParam))
  const [mode, setMode] = useState<Mode>(modeFor(tab))
  useEffect(() => { if (tab !== 'portfolio') setMode(modeFor(tab)) }, [tab])

  const all = useAllSeriesStats()
  const stats = all.stats[index] ?? mockStats(series)
  const ledger = useLedger(series)
  const position = usePosition(series)
  const history = useYtHistory(series, index)
  const active = tab === 'earn' ? 'earn' : tab === 'portfolio' ? 'portfolio' : tab === 'split' || tab === 'merge' ? 'split' : 'buy'

  const pick = (i: number) => {
    const q = new URLSearchParams(params.toString())
    q.set('s', String(i))
    router.replace(`/app?${q.toString()}`, { scroll: false })
  }

  return (
    <AppShell active={active}>
      {tab === 'portfolio' && <div className="wrap" style={{ paddingTop: 28 }}><Portfolio /><Activity /></div>}
      <div className="wrap applay" style={tab === 'portfolio' ? { paddingTop: 16 } : undefined}>
        <div>
          <div className="panel">
            <h4><span id="aTtl" style={{ fontSize: 14, color: 'var(--fg)', fontFamily: 'var(--font-inter), Inter, system-ui, sans-serif' }}>{series.ticker} · {monthYear(series.maturity)}</span><BlockLabel /></h4>
            <SeriesSelector current={index} onPick={pick} />
            {all.isError && <Banner kind="r">{RPC_ERROR_TEXT}</Banner>}
            <KPIs stats={stats} ytChange24h={history.change24hPct} tvlChange7d={history.tvlChange7dPct} />
            <YtChart ticker={series.ticker} points={history.points} days={history.days} changePct={history.changePct} />
          </div>
          <DividendLedger ledger={ledger} />
        </div>
        <div>
          <ActionPanel series={series} stats={stats} position={position} mode={mode} onMode={setMode} initialSide={side === 'yt' ? 'yt' : side === 'pt' ? 'pt' : undefined} />
          <Position series={series} stats={stats} position={position} />
        </div>
      </div>
    </AppShell>
  )
}
