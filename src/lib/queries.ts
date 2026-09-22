import type { QueryClient } from '@tanstack/react-query'

/** Refetch on-chain reads (balances, allowances, stats, the wallet's activity) after a transaction — not the chart history. */
export function invalidateChainReads(qc: QueryClient) {
  const keys = new Set(['readContracts', 'readContract', 'balance', 'blockNumber', 'activity'])
  void qc.invalidateQueries({ predicate: (q) => keys.has(String(q.queryKey[0])) })
}
