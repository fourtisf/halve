import { afterEach, describe, expect, it, vi } from 'vitest'

/** env.ts reads process.env at import time, so every case re-imports a fresh module. */
async function load(vars: Record<string, string | undefined>) {
  vi.resetModules()
  for (const k of ['NEXT_PUBLIC_RPC_URL', 'NEXT_PUBLIC_RPC_URLS']) delete process.env[k]
  for (const [k, v] of Object.entries(vars)) if (v !== undefined) process.env[k] = v
  return import('./env')
}

describe('RPC_URLS', () => {
  afterEach(() => { for (const k of ['NEXT_PUBLIC_RPC_URL', 'NEXT_PUBLIC_RPC_URLS']) delete process.env[k] })

  it('is empty when nothing is configured, so the chain default applies', async () => {
    const env = await load({})
    expect(env.RPC_URL).toBeUndefined()
    expect(env.RPC_URLS).toEqual([])
  })

  it('puts NEXT_PUBLIC_RPC_URL first and the comma-separated fallbacks after it, trimmed and deduplicated', async () => {
    const env = await load({ NEXT_PUBLIC_RPC_URL: 'https://a.example/rpc', NEXT_PUBLIC_RPC_URLS: ' https://b.example ,https://a.example/rpc,, https://c.example ' })
    expect(env.RPC_URLS).toEqual(['https://a.example/rpc', 'https://b.example', 'https://c.example'])
  })

  it('works with fallbacks alone', async () => {
    const env = await load({ NEXT_PUBLIC_RPC_URLS: 'https://b.example,https://c.example' })
    expect(env.RPC_URL).toBeUndefined()
    expect(env.RPC_URLS).toEqual(['https://b.example', 'https://c.example'])
  })
})

describe('chain transport', () => {
  it('is a single http transport with one URL and a fallback over several', async () => {
    await load({ NEXT_PUBLIC_RPC_URL: 'https://a.example' })
    let chain = await import('./chain')
    expect(chain.RPC_HTTP).toBe('https://a.example')
    expect(chain.RPC_HTTPS).toEqual(['https://a.example'])
    expect(chain.rpcTransport()({ chain: chain.robinhood }).config.type).toBe('http')

    await load({ NEXT_PUBLIC_RPC_URL: 'https://a.example', NEXT_PUBLIC_RPC_URLS: 'https://b.example' })
    chain = await import('./chain')
    expect(chain.RPC_HTTPS).toEqual(['https://a.example', 'https://b.example'])
    expect(chain.robinhood.rpcUrls.default.http).toEqual(['https://a.example', 'https://b.example'])
    expect(chain.rpcTransport()({ chain: chain.robinhood }).config.type).toBe('fallback')
  })

  it('keeps the chain default when nothing is configured', async () => {
    await load({})
    const chain = await import('./chain')
    expect(chain.RPC_HTTP).toBe('https://rpc.mainnet.chain.robinhood.com')
    expect(chain.CHAIN_ID).toBe(4663)
  })
})
