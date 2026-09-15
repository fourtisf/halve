import type { Metadata } from 'next'
import { Docs } from '@/components/Docs'

export const metadata: Metadata = { title: 'Docs', description: 'How Halve splits tokenized stocks into principal and yield tokens: lifecycle, maths, fees, the dividend accountant, contract addresses and the HTTP API.' }

export default function DocsPage() {
  return <Docs />
}
