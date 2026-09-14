import { Suspense } from 'react'
import type { Metadata } from 'next'
import { AppPage } from '@/components/AppPage'

export const metadata: Metadata = { title: 'App — Halve' }

export default function Page() {
  return (
    <Suspense fallback={<div className="wrap applay" />}>
      <AppPage />
    </Suspense>
  )
}
