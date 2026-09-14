'use client'
import { useEffect, useState } from 'react'

/** True after hydration; use to avoid SSR/client mismatches on wallet state. */
export function useIsMounted(): boolean {
  const [m, setM] = useState(false)
  useEffect(() => setM(true), [])
  return m
}
