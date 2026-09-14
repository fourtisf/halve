'use client'
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

type Ctx = { isOpen: boolean; open: () => void; close: () => void }
const WalletModalCtx = createContext<Ctx | null>(null)

export function WalletModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setOpen] = useState(false)
  const open = useCallback(() => setOpen(true), [])
  const close = useCallback(() => setOpen(false), [])
  const value = useMemo(() => ({ isOpen, open, close }), [isOpen, open, close])
  return <WalletModalCtx.Provider value={value}>{children}</WalletModalCtx.Provider>
}

export function useWalletModal(): Ctx {
  const c = useContext(WalletModalCtx)
  if (!c) throw new Error('useWalletModal outside WalletModalProvider')
  return c
}
