'use client'
/**
 * In-memory position store used in MOCK mode (mirrors the prototype's `pos` object).
 * Persisted to sessionStorage so a refresh keeps the demo position for the tab.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type MockPos = { pt: number; yt: number; lp: number }
type Store = {
  pos: Record<string, MockPos>
  update: (ticker: string, fn: (p: MockPos) => MockPos) => void
}

const KEY = 'halve:mockpos'
const Ctx = createContext<Store | null>(null)

function load(): Record<string, MockPos> {
  try {
    const raw = sessionStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Record<string, MockPos>) : {}
  } catch {
    return {}
  }
}

export function MockPositionProvider({ children }: { children: ReactNode }) {
  const [pos, setPos] = useState<Record<string, MockPos>>({})
  useEffect(() => setPos(load()), []) // after hydration, so SSR and first client render match
  const update = useCallback((ticker: string, fn: (p: MockPos) => MockPos) => {
    setPos((prev) => {
      const next = { ...prev, [ticker]: fn(prev[ticker] ?? { pt: 0, yt: 0, lp: 0 }) }
      try { sessionStorage.setItem(KEY, JSON.stringify(next)) } catch { /* storage unavailable */ }
      return next
    })
  }, [])
  const value = useMemo(() => ({ pos, update }), [pos, update])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useMockPositions(): Store {
  const s = useContext(Ctx)
  if (!s) throw new Error('useMockPositions outside MockPositionProvider')
  return s
}
