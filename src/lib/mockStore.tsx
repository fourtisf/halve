'use client'
/** In-memory position store used in MOCK mode (mirrors the prototype's `pos` object). */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

export type MockPos = { pt: number; yt: number; lp: number }
type Store = {
  pos: Record<string, MockPos>
  update: (ticker: string, fn: (p: MockPos) => MockPos) => void
}

const Ctx = createContext<Store | null>(null)

export function MockPositionProvider({ children }: { children: ReactNode }) {
  const [pos, setPos] = useState<Record<string, MockPos>>({})
  const update = useCallback((ticker: string, fn: (p: MockPos) => MockPos) => {
    setPos((prev) => ({ ...prev, [ticker]: fn(prev[ticker] ?? { pt: 0, yt: 0, lp: 0 }) }))
  }, [])
  const value = useMemo(() => ({ pos, update }), [pos, update])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useMockPositions(): Store {
  const s = useContext(Ctx)
  if (!s) throw new Error('useMockPositions outside MockPositionProvider')
  return s
}
