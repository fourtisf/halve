import type { Metadata, Viewport } from 'next'
import { Inter, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import { Providers } from '@/lib/providers'
import { SITE_URL } from '@/lib/env'
import { X_HANDLE } from '@/lib/links'
import { Nav } from '@/components/Nav'
import { Announce } from '@/components/Announce'
import { Footer } from '@/components/Footer'
import { WalletModal } from '@/components/WalletModal'
import { Toast } from '@/components/Toast'

const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-inter', display: 'swap' })
const geistMono = Geist_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-geist-mono', display: 'swap' })

const TITLE = 'Halve — Fixed yield and dividend tokens for tokenized stocks'
const DESCRIPTION = 'Halve splits a tokenized stock or ETF into the share at a discount and every dividend it pays until a fixed date. Live on Robinhood Chain.'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: '%s — Halve' },
  description: DESCRIPTION,
  applicationName: 'Halve',
  openGraph: { title: TITLE, description: DESCRIPTION, siteName: 'Halve', type: 'website', url: '/' },
  twitter: { card: 'summary_large_image', site: X_HANDLE, creator: X_HANDLE, title: TITLE, description: DESCRIPTION },
  robots: { index: true, follow: true },
}

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#000000' }

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${geistMono.variable}`}>
      <body>
        <Providers>
          <Announce />
          <Nav />
          {children}
          <Footer />
          <WalletModal />
          <Toast />
        </Providers>
        {process.env.VERCEL ? <Analytics /> : null}
      </body>
    </html>
  )
}
