'use client'
/**
 * In-memory position store used in MOCK mode (mirrors the prototype's `pos` object), plus the demo
 * wallet's activity log. Persisted to sessionStorage so a refresh keeps the demo state for the tab.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { ActivityRow } from './activity'
import { MOCK } from './env'

export type MockPos = { pt: number; yt: number; lp: number }
/** A demo limit order: sits open until cancelled (nothing moves the demo price through it). */
export type MockOrder = { id: string; ticker: string; token: 'pt' | 'yt'; side: 'buy' | 'sell'; price: number; amount: number; ts: number }
type State = { pos: Record<string, MockPos>; log: ActivityRow[]; orders: MockOrder[] }
type Store = State & {
  update: (ticker: string, fn: (p: MockPos) => MockPos) => void
  record: (row: ActivityRow) => void
  addOrder: (o: MockOrder) => void
  removeOrder: (id: string) => void
}

const KEY = 'halve:mock:v2'
const EMPTY: State = { pos: {}, log: [], orders: [] }
const Ctx = createContext<Store | null>(null)

function load(): State {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return EMPTY
    const j = JSON.parse(raw) as Partial<State>
    return { pos: j.pos ?? {}, log: Array.isArray(j.log) ? j.log : [], orders: Array.isArray(j.orders) ? j.orders : [] }
  } catch {
    return EMPTY
  }
}

function save(s: State) {
  if (!MOCK) return
  try { sessionStorage.setItem(KEY, JSON.stringify(s)) } catch { /* storage unavailable */ }
}

export function MockPositionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(EMPTY)
  // After hydration, so SSR and the first client render match. A live build never rehydrates demo state and drops
  // what an earlier mock-mode visit left in this tab, so demo holdings, orders and activity can never show as real.
  useEffect(() => {
    if (MOCK) setState(load())
    else try { sessionStorage.removeItem(KEY) } catch { /* storage unavailable */ }
  }, [])
  const update = useCallback((ticker: string, fn: (p: MockPos) => MockPos) => {
    setState((prev) => {
      const next = { ...prev, pos: { ...prev.pos, [ticker]: fn(prev.pos[ticker] ?? { pt: 0, yt: 0, lp: 0 }) } }
      save(next)
      return next
    })
  }, [])
  const record = useCallback((row: ActivityRow) => {
    setState((prev) => {
      const next = { ...prev, log: [...prev.log, { ...row, seq: (prev.log[prev.log.length - 1]?.seq ?? -1) + 1 }].slice(-200) }
      save(next)
      return next
    })
  }, [])
  const addOrder = useCallback((o: MockOrder) => {
    setState((prev) => { const next = { ...prev, orders: [...prev.orders, o] }; save(next); return next })
  }, [])
  const removeOrder = useCallback((id: string) => {
    setState((prev) => { const next = { ...prev, orders: prev.orders.filter((o) => o.id !== id) }; save(next); return next })
  }, [])
  const value = useMemo(() => ({ ...state, update, record, addOrder, removeOrder }), [state, update, record, addOrder, removeOrder])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useMockPositions(): Store {
  const s = useContext(Ctx)
  if (!s) throw new Error('useMockPositions outside MockPositionProvider')
  return s
}
