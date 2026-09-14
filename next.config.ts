import type { NextConfig } from 'next'

// Optional peers of @coinbase/cdp-sdk (pulled in transitively by wagmi/connectors) that are never
// executed by Halve but fail module resolution at build time.
const OPTIONAL_PEERS = ['@x402/core/client', '@x402/evm', '@x402/evm/exact/client', '@x402/evm/upto/client', '@x402/svm/exact/client']
const EMPTY = './src/stubs/empty.cjs'

// Wallet connections need WalletConnect relays, the RPC and wallet icons; everything else is locked down.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https: wss:",
  'frame-src https://verify.walletconnect.com https://verify.walletconnect.org https://secure.walletconnect.com https://secure.walletconnect.org',
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ')

const SECURITY_HEADERS = [
  { key: 'Content-Security-Policy', value: CSP },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
]

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  env: {
    // `MOCK=true` in .env works as well as NEXT_PUBLIC_MOCK; defaults to mock until series.json has real addresses.
    NEXT_PUBLIC_MOCK: process.env.NEXT_PUBLIC_MOCK ?? process.env.MOCK ?? 'true',
  },
  async headers() {
    return [{ source: '/(.*)', headers: SECURITY_HEADERS }]
  },
  turbopack: {
    resolveAlias: Object.fromEntries(OPTIONAL_PEERS.map((p) => [p, EMPTY])),
  },
  webpack: (config) => {
    config.resolve.alias = { ...config.resolve.alias, ...Object.fromEntries(OPTIONAL_PEERS.map((p) => [p, false])) }
    config.externals.push('pino-pretty', 'lokijs', 'encoding')
    return config
  },
}

export default nextConfig
