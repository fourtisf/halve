/** Wallet activity (splits, merges, redemptions) and a simple PnL. Pure; unit-tested. */

export type ActivityAction = 'Split' | 'Merge' | 'Redeem PT' | 'Redeem YT' | 'Buy'

export type ActivityRow = {
  id: string // series id
  ticker: string
  action: ActivityAction
  ts: number // unix seconds (0 when unknown)
  amount: number // stock units in (Split) or out (Merge / Redeem)
  base: number // PT/YT units minted or burned
  txHash?: `0x${string}`
  block?: number
  note?: string // free text for trades ("0.1 ETH → 2.4 pSPY")
  seq?: number // insertion counter for rows without a block (demo log), so same-second rows keep their order
}

export type PnlRow = {
  id: string
  ticker: string
  deposited: number // stock sent in through splits (gross, fee included)
  withdrawn: number // stock received from merges and redemptions
  holdings: number // current PT + YT at pool prices, in stock
  pnl: number // withdrawn + holdings − deposited, in stock
  pnlUsd: number
}

export type PnlInputs = { id: string; ticker: string; pt: number; yt: number; ptPrice: number; ytPrice: number; usdPrice: number }

/** Newest first: by timestamp, then block, then insertion counter. Idempotent, so sorting twice is safe. */
export function sortActivity(rows: readonly ActivityRow[]): ActivityRow[] {
  return [...rows].sort((a, b) => b.ts - a.ts || (b.block ?? 0) - (a.block ?? 0) || (b.seq ?? 0) - (a.seq ?? 0))
}

/** One PnL row per series that has activity or a balance. */
export function summarizePnl(rows: readonly ActivityRow[], positions: readonly PnlInputs[]): { rows: PnlRow[]; total: { deposited: number; withdrawn: number; holdings: number; pnl: number; pnlUsd: number } } {
  const byId = new Map<string, PnlRow>()
  const usd = new Map(positions.map((p) => [p.id, p.usdPrice]))
  for (const p of positions) {
    const holdings = p.pt * p.ptPrice + p.yt * p.ytPrice
    if (holdings > 0) byId.set(p.id, { id: p.id, ticker: p.ticker, deposited: 0, withdrawn: 0, holdings, pnl: 0, pnlUsd: 0 })
  }
  for (const r of rows) {
    const row = byId.get(r.id) ?? { id: r.id, ticker: r.ticker, deposited: 0, withdrawn: 0, holdings: 0, pnl: 0, pnlUsd: 0 }
    if (r.action === 'Split') row.deposited += r.amount
    else if (r.action === 'Buy') row.deposited += r.amount // paid in stock (or ETH, shown as a note); counts as capital in
    else row.withdrawn += r.amount
    byId.set(r.id, row)
  }
  const out = [...byId.values()].map((r) => {
    const pnl = r.withdrawn + r.holdings - r.deposited
    return { ...r, pnl, pnlUsd: pnl * (usd.get(r.id) ?? 0) }
  })
  const total = out.reduce(
    (a, r) => ({ deposited: a.deposited + r.deposited, withdrawn: a.withdrawn + r.withdrawn, holdings: a.holdings + r.holdings, pnl: a.pnl + r.pnl, pnlUsd: a.pnlUsd + r.pnlUsd }),
    { deposited: 0, withdrawn: 0, holdings: 0, pnl: 0, pnlUsd: 0 },
  )
  return { rows: out, total }
}
