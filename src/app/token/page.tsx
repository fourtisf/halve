import type { Metadata } from 'next'
import { TokenPage } from '@/components/TokenPage'

export const metadata: Metadata = { title: '$HALVE — Halve' }

export default function Page() {
  return <TokenPage />
}
