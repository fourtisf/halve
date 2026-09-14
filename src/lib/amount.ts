/** "1." → "1", ".5" → "0.5"; returns null when not a positive decimal. */
export function cleanAmount(input: string): { str: string; num: number } | null {
  const s = input.trim().replace(/^\./, '0.').replace(/\.$/, '')
  if (!/^\d+(\.\d+)?$/.test(s)) return null
  const num = parseFloat(s)
  return num > 0 ? { str: s, num } : null
}
