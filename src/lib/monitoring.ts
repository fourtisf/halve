/** Minimal, dependency-free error reporting. Posts to NEXT_PUBLIC_ERROR_ENDPOINT when set; always logs. */
import { ERROR_ENDPOINT } from './env'

export function reportError(error: unknown, context: Record<string, unknown> = {}): void {
  const e = error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : { message: String(error) }
  console.error('[halve]', e.message, context)
  if (!ERROR_ENDPOINT || typeof window === 'undefined') return
  try {
    const body = JSON.stringify({ ...e, ...context, url: window.location.href, ua: navigator.userAgent, ts: Date.now() })
    if (navigator.sendBeacon) navigator.sendBeacon(ERROR_ENDPOINT, body)
    else void fetch(ERROR_ENDPOINT, { method: 'POST', body, keepalive: true, headers: { 'content-type': 'application/json' } })
  } catch {
    // never throw from the reporter
  }
}
