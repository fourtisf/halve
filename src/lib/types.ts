export type SeriesStats = {
  /** True when numbers come from the prototype mock (MOCK flag or placeholder addresses). */
  isMock: boolean
  /** False while live reads are still loading. */
  ready: boolean
  ptPrice: number // PT/stock pool price, in stock units
  ytPrice: number // YT/stock pool price, in stock units
  fixedApy: number // fraction: (1/ptPrice)^(1/yearsToMaturity) − 1
  leverage: number // 1/ytPrice
  divYield: number // implied annual distribution yield (fraction)
  yearsToMaturity: number
  totalDeposits: bigint // raw units
  cap: bigint // raw units
  capacityUsed: number // fraction 0..1
  usdPrice: number // stock USD price (Chainlink, multiplier already inside)
  tvlUsd: number
  dividendIndex: number // 1.0 = 1e18
  d0: number
  accrued: number // dividendIndex / d0 − 1
  uiMultiplier: number // ERC-8056 display multiplier: shares per raw token (1.0 = 1e18)
  splitFactor: number
  isSynced: boolean
  events: number // classified checkpoints this term
  state: number // vault state
  decimals: number
  tvlChange7d: number | null // percent; mock only until KV history exists (phase 2)
  ytChange24h: number | null // percent
}

export type LedgerEvent = 'Dividend' | 'Split' | 'Special dividend' | 'Unclassified'

export type LedgerRow = {
  ts: number
  event: LedgerEvent
  ratio: number
  indexAfter: number | null // null while pending
  held: boolean
  timelockRemaining?: number // seconds, held rows only
}

export type Ledger = {
  rows: LedgerRow[] // newest first, pending row (if any) first
  pending: LedgerRow | null
  events: number
  isLoading: boolean
  isMock: boolean
}

export type PositionData = {
  isMock: boolean
  connected: boolean
  wrongChain: boolean
  stock: number // spendable stock balance
  pt: number
  yt: number
  lp: number // phase 2 (router positions)
  stockRaw: bigint
  ptRaw: bigint
  ytRaw: bigint
  allowance: { stock: bigint; pt: bigint; yt: bigint }
  refetch: () => void
}

export type TxStatus = 'idle' | 'approving' | 'sending' | 'confirming' | 'done' | 'error'
