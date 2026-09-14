'use client'
import { useEffect } from 'react'
import { reportError } from '@/lib/monitoring'

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => reportError(error, { digest: error.digest, boundary: 'route' }), [error])
  return (
    <div className="wrap err">
      <div>
        <div className="eyebrow" style={{ marginBottom: 20 }}>Something broke</div>
        <h1>This page hit an error.</h1>
        <p>Your funds are unaffected. Merge and redeem never depend on this site.</p>
        <button className="btn btn-white btn-lg" onClick={reset}>Try again</button>
      </div>
    </div>
  )
}
