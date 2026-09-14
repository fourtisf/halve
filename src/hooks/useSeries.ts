'use client'
import { useMemo } from 'react'
import { SERIES, hasPlaceholderAddresses, type Series } from '@/contracts/types'
import { MOCK } from '@/lib/env'

/** All series from series.json, in file order. */
export function useSeries(): readonly Series[] {
  return SERIES
}

/** Series at an index, clamped; index 1 (JEPI) is the prototype default. */
export function useSeriesAt(index: number): { series: Series; index: number } {
  return useMemo(() => {
    const i = Number.isInteger(index) && index >= 0 && index < SERIES.length ? index : Math.min(1, SERIES.length - 1)
    return { series: SERIES[i], index: i }
  }, [index])
}

/** Whether a series should fall back to the prototype's mock numbers. */
export function isMockSeries(s: Series): boolean {
  return MOCK || hasPlaceholderAddresses(s)
}

export function useIsMock(s: Series): boolean {
  return isMockSeries(s)
}

/** Distinct issuers across live series ("3 issuers"). */
export function issuerCount(list: readonly Series[]): number {
  return new Set(list.map((s) => s.issuer)).size
}
