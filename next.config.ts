import type { NextConfig } from 'next'

// Optional peers of @coinbase/cdp-sdk (pulled in transitively by wagmi/connectors) that are never
// executed by Halve but fail module resolution at build time.
const OPTIONAL_PEERS = ['@x402/core/client', '@x402/evm', '@x402/evm/exact/client', '@x402/evm/upto/client', '@x402/svm/exact/client']
const EMPTY = './src/stubs/empty.cjs'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: {
    // `MOCK=true` in .env works as well as NEXT_PUBLIC_MOCK; defaults to mock until series.json has real addresses.
    NEXT_PUBLIC_MOCK: process.env.NEXT_PUBLIC_MOCK ?? process.env.MOCK ?? 'true',
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
