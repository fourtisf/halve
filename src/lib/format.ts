/** Number formatting, identical to the prototype's helpers. */

/** f(n, d) — tabular number with exactly d decimals (prototype `f`). */
export const f = (n: number, d = 4): string =>
  (Number.isFinite(n) ? n : 0).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })

/** usd(n) — "$18.6M" / "$412K" (prototype `usd`). */
export const usd = (n: number): string => (n >= 1e6 ? '$' + (n / 1e6).toFixed(1) + 'M' : '$' + Math.round(n / 1e3) + 'K')

/** USD with `$` and 2 dp. */
export const usd2 = (n: number): string => '$' + f(n, 2)

/** Percent with 1 dp from a fraction (0.074 → "7.4%"). */
export const pct1 = (frac: number): string => f(frac * 100, 1) + '%'

/** "0x7A3f…C32F" */
export const shortAddr = (a: string): string => a.slice(0, 6) + '…' + a.slice(-4)

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "Mar 2027" from a unix timestamp (UTC). */
export const monthYear = (ts: number): string => {
  const d = new Date(ts * 1000)
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

/** "1d 06h" from seconds remaining. */
export const dh = (seconds: number): string => {
  const s = Math.max(0, Math.floor(seconds))
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  return `${d}d ${String(h).padStart(2, '0')}h`
}

export const fmtInt = (n: number | bigint): string => n.toLocaleString('en-US')
