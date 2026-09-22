'use client'
import { useMemo } from 'react'
import { SERIES, hasPlaceholderAddresses, type Series } from '@/contracts/types'
import { MOCK } from '@/lib/env'

/** All series from series.json, in file order. */
export function useSeries(): readonly Series[] {
  return SERIES
}

/** Whether a series should fall back to the prototype's mock numbers. */
export function isMockSeries(s: Series): boolean {
  return MOCK || hasPlaceholderAddresses(s)
}

/** The series /app opens without ?s=: the first deployed one, else the second entry (SCHD, the prototype's default). */
export const DEFAULT_SERIES_INDEX: number = (() => {
  const live = SERIES.findIndex((s) => !isMockSeries(s))
  return live >= 0 ? live : Math.min(1, SERIES.length - 1)
})()

/** Series at an index, clamped to DEFAULT_SERIES_INDEX when out of range. */
export function useSeriesAt(index: number): { series: Series; index: number } {
  return useMemo(() => {
    const i = Number.isInteger(index) && index >= 0 && index < SERIES.length ? index : DEFAULT_SERIES_INDEX
    return { series: SERIES[i], index: i }
  }, [index])
}

export function useIsMock(s: Series): boolean {
  return isMockSeries(s)
}

/** Distinct issuers across live series ("3 issuers"). */
export function issuerCount(list: readonly Series[]): number {
  return new Set(list.map((s) => s.issuer)).size
}
