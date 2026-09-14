/** Helper to read a `useReadContracts` result slot (allowFailure: true). */
export type ReadResult = { status: 'success'; result: unknown } | { status: 'failure'; error: Error }

export function ok<T>(data: readonly ReadResult[] | undefined, i: number): T | undefined {
  const r = data?.[i]
  return r && r.status === 'success' ? (r.result as T) : undefined
}
