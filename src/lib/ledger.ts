/** Pure ledger builder behind useLedger. Unit-tested. */
import { GUARDIAN_TIMELOCK_SECONDS, WAD } from '@/contracts/constants'
import type { LedgerEvent, LedgerRow } from './types'
import { classifyRatio, wadToNumber } from './math'

export type Checkpoint = readonly [bigint, number, bigint, bigint]
export type PendingTuple = readonly [boolean, bigint, bigint, bigint]

export const CHECKPOINT_KIND: Record<number, LedgerEvent> = { 0: 'Dividend', 1: 'Split', 2: 'Special dividend' }

export function checkpointRow(cp: Checkpoint): LedgerRow {
  return { ts: Number(cp[0]), event: CHECKPOINT_KIND[cp[1]] ?? 'Unclassified', ratio: wadToNumber(cp[2]), indexAfter: wadToNumber(cp[3]), held: false }
}

/** pending() → a gold "Held · timelock" row, or null when nothing is queued. `ts` is the queue time. */
export function pendingRow(p: PendingTuple | undefined, now: number): LedgerRow | null {
  if (!p || !p[0]) return null
  const [, ts, oldM, newM] = p
  const ratio = oldM > 0n ? Number((newM * WAD) / oldM) / 1e18 : 0
  return {
    ts: Number(ts),
    event: classifyRatio(ratio),
    ratio,
    indexAfter: null,
    held: true,
    timelockRemaining: Math.max(0, Number(ts) + GUARDIAN_TIMELOCK_SECONDS - now),
  }
}

/**
 * Rows newest first, pending row first. `checkpoints[i]` undefined = read failed; when probing
 * (no checkpointCount()), the first failure ends the list.
 */
export function buildLedger(
  checkpoints: readonly (Checkpoint | undefined)[],
  pending: PendingTuple | undefined,
  opts: { probing: boolean; now: number },
): { rows: LedgerRow[]; pending: LedgerRow | null; events: number } {
  const rows: LedgerRow[] = []
  for (const cp of checkpoints) {
    if (!cp) {
      if (opts.probing) break
      continue
    }
    rows.push(checkpointRow(cp))
  }
  rows.sort((a, b) => b.ts - a.ts)
  const p = pendingRow(pending, opts.now)
  return { rows: p ? [p, ...rows] : rows, pending: p, events: rows.length }
}
