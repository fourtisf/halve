'use client'
/**
 * In-memory position store used in MOCK mode (mirrors the prototype's `pos` object), plus the demo
 * wallet's activity log. Persisted to sessionStorage so a refresh keeps the demo state for the tab.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { ActivityRow } from './activity'

export type MockPos = { pt: number; yt: number; lp: number }
type State = { pos: Record<string, MockPos>; log: ActivityRow[] }
type Store = State & {
  update: (ticker: string, fn: (p: MockPos) => MockPos) => void
  record: (row: ActivityRow) => void
}

const KEY = 'halve:mock:v2'
const EMPTY: State = { pos: {}, log: [] }
const Ctx = createContext<Store | null>(null)

function load(): State {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return EMPTY
    const j = JSON.parse(raw) as Partial<State>
    return { pos: j.pos ?? {}, log: Array.isArray(j.log) ? j.log : [] }
  } catch {
    return EMPTY
  }
}

function save(s: State) {
  try { sessionStorage.setItem(KEY, JSON.stringify(s)) } catch { /* storage unavailable */ }
}

export function MockPositionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(EMPTY)
  useEffect(() => setState(load()), []) // after hydration, so SSR and first client render match
  const update = useCallback((ticker: string, fn: (p: MockPos) => MockPos) => {
    setState((prev) => {
      const next = { ...prev, pos: { ...prev.pos, [ticker]: fn(prev.pos[ticker] ?? { pt: 0, yt: 0, lp: 0 }) } }
      save(next)
      return next
    })
  }, [])
  const record = useCallback((row: ActivityRow) => {
    setState((prev) => {
      const next = { ...prev, log: [...prev.log, row].slice(-200) }
      save(next)
      return next
    })
  }, [])
  const value = useMemo(() => ({ ...state, update, record }), [state, update, record])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useMockPositions(): Store {
  const s = useContext(Ctx)
  if (!s) throw new Error('useMockPositions outside MockPositionProvider')
  return s
}
