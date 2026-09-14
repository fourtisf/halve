import type { Metadata, Viewport } from 'next'
import { Inter, Geist_Mono } from 'next/font/google'
import './globals.css'
import { Providers } from '@/lib/providers'
import { Nav } from '@/components/Nav'
import { Footer } from '@/components/Footer'
import { WalletModal } from '@/components/WalletModal'
import { Toast } from '@/components/Toast'

const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-inter', display: 'swap' })
const geistMono = Geist_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-geist-mono', display: 'swap' })

export const metadata: Metadata = {
  title: 'Halve — Fixed yield and dividend tokens for tokenized stocks',
  description: 'Halve splits a tokenized stock or ETF into the share at a discount and every dividend it pays until a fixed date. Live on Robinhood Chain.',
}

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#000000' }

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${geistMono.variable}`}>
      <body>
        <Providers>
          <Nav />
          {children}
          <Footer />
          <WalletModal />
          <Toast />
        </Providers>
      </body>
    </html>
  )
}
