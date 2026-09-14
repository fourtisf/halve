'use client'
import { useMemo } from 'react'
import { f } from '@/lib/format'

/** 30d YT price line — same path math as the prototype's chart(). */
export function YtChart({ ticker, points, days, changePct }: { ticker: string; points: number[]; days: number; changePct: number | null }) {
  const d = useMemo(() => {
    if (points.length < 2) return ''
    const mn = Math.min(...points)
    const mx = Math.max(...points)
    const span = mx - mn || 1
    const step = 600 / (points.length - 1)
    return points.map((y, i) => (i ? 'L' : 'M') + (i * step).toFixed(1) + ',' + (110 - ((y - mn) / span) * 95).toFixed(2)).join(' ')
  }, [points])
  const change = changePct == null ? null : (changePct >= 0 ? '+' : '') + f(changePct, 1) + '%'
  return (
    <div className="chart">
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--fg3)', marginBottom: 8, fontFamily: 'var(--mono)' }}>
        <span id="chLbl">y{ticker} · {days || 30}d</span>
        {change != null && <span className={changePct != null && changePct < 0 ? 'r' : 'g'}>{change}</span>}
      </div>
      <svg viewBox="0 0 600 120" preserveAspectRatio="none">
        <defs><linearGradient id="a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#E8C170" stopOpacity=".3" /><stop offset="1" stopColor="#E8C170" stopOpacity="0" /></linearGradient></defs>
        <path id="area" fill="url(#a)" d={d ? d + ' L600,120 L0,120 Z' : undefined} />
        <path id="line" fill="none" stroke="#E8C170" strokeWidth="1.6" d={d || undefined} />
      </svg>
    </div>
  )
}
