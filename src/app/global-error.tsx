'use client'
import { useEffect } from 'react'
import { reportError } from '@/lib/monitoring'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => reportError(error, { digest: error.digest, boundary: 'global' }), [error])
  return (
    <html lang="en">
      <body style={{ background: '#000', color: '#FAFAFA', fontFamily: 'Inter, system-ui, sans-serif', display: 'grid', placeItems: 'center', minHeight: '100vh', margin: 0, textAlign: 'center' }}>
        <div>
          <h1 style={{ fontWeight: 500, letterSpacing: '-.04em', fontSize: 40 }}>Halve hit an error.</h1>
          <p style={{ color: '#A1A1A1', margin: '12px 0 24px' }}>Your funds are unaffected. Merge and redeem never depend on this site.</p>
          <button onClick={reset} style={{ background: '#FAFAFA', color: '#000', border: 0, borderRadius: 11, height: 46, padding: '0 22px', fontSize: 15, fontWeight: 500, cursor: 'pointer' }}>Try again</button>
        </div>
      </body>
    </html>
  )
}
