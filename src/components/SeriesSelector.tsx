'use client'
import { useSeries } from '@/hooks/useSeries'

export function SeriesSelector({ current, onPick }: { current: number; onPick: (i: number) => void }) {
  const series = useSeries()
  return (
    <div className="side-sel" id="serSel">
      {series.map((s, i) => <button key={s.id} id={`ss${i}`} className={i === current ? 'on' : undefined} onClick={() => onPick(i)}>{s.ticker}</button>)}
    </div>
  )
}
