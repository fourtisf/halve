import { Hero } from '@/components/Hero'
import { MarketsTable } from '@/components/MarketsTable'
import { HowGrid } from '@/components/HowGrid'
import { WhyGrid } from '@/components/WhyGrid'
import { TrustStrip } from '@/components/TrustStrip'
import { FAQ } from '@/components/FAQ'
import { CTA } from '@/components/CTA'

export default function HomePage() {
  return (
    <div id="p-home">
      <Hero />
      <MarketsTable />
      <HowGrid />
      <WhyGrid />
      <TrustStrip />
      <FAQ />
      <CTA />
    </div>
  )
}
