'use client'
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'

type ToastCtx = { toast: (msg: string) => void; message: string; show: boolean }
const Ctx = createContext<ToastCtx | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState('')
  const [show, setShow] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toast = useCallback((msg: string) => {
    setMessage(msg)
    setShow(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setShow(false), 2500)
  }, [])
  const value = useMemo(() => ({ toast, message, show }), [toast, message, show])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useToast(): ToastCtx {
  const c = useContext(Ctx)
  if (!c) throw new Error('useToast outside ToastProvider')
  return c
}

/** Short, user-facing message from a viem/wagmi error. */
export function shortError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)
  if (/user rejected|user denied|rejected the request/i.test(msg)) return 'Transaction rejected'
  if (/insufficient funds/i.test(msg)) return 'Insufficient funds for gas'
  if (/chain mismatch|switch chain/i.test(msg)) return 'Switch to Robinhood Chain (4663)'
  const first = msg.split('\n')[0]
  return first.length > 90 ? first.slice(0, 87) + '…' : first
}
