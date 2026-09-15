import { describe, expect, it } from 'vitest'
import { isLocalRpc, parseEnv, uintOrNull, walletArgsFrom } from './env.mjs'

describe('parseEnv', () => {
  it('drops inline comments from unquoted values and ignores comment / blank lines', () => {
    const e = parseEnv(`# header
MATURITY=1806451200               # unix timestamp
VERIFY=1   # verify sources
TICKER=SPY # must match series.json

export CAP=1000000000000000000000000
`, '/home/op')
    expect(e).toEqual({ MATURITY: '1806451200', VERIFY: '1', TICKER: 'SPY', CAP: '1000000000000000000000000' })
  })
  it('keeps # inside quoted values, strips the quotes, and treats empty as unset', () => {
    const e = parseEnv(`A="x # not a comment"  # real comment
B='y'
DEPLOYER_KEY=                     # 0x… private key
STOCK=
C=
`, '/home/op')
    expect(e).toEqual({ A: 'x # not a comment', B: 'y' })
    expect('DEPLOYER_KEY' in e).toBe(false)
  })
  it('expands ~ at the start of a value and inside space-separated arguments', () => {
    const e = parseEnv(`WALLET_ARGS=--account halve --password-file ~/.halve.pass
PASS=~/.p
NOT=a~b
`, '/home/op')
    expect(e.WALLET_ARGS).toBe('--account halve --password-file /home/op/.halve.pass')
    expect(e.PASS).toBe('/home/op/.p')
    expect(e.NOT).toBe('a~b')
  })
  it('handles CRLF files', () => {
    expect(parseEnv('A=1\r\nB=2\r\n', '/h')).toEqual({ A: '1', B: '2' })
  })
})

describe('helpers', () => {
  it('builds wallet arguments and prefers the keystore form', () => {
    expect(walletArgsFrom({ WALLET_ARGS: '--account halve --password-file /root/.p' })).toEqual(['--account', 'halve', '--password-file', '/root/.p'])
    expect(walletArgsFrom({ DEPLOYER_KEY: '0xabc' })).toEqual(['--private-key', '0xabc'])
    expect(walletArgsFrom({})).toBeNull()
  })
  it('recognises local RPCs', () => {
    expect(isLocalRpc('http://127.0.0.1:8545')).toBe(true)
    expect(isLocalRpc('http://localhost:8546/')).toBe(true)
    expect(isLocalRpc('https://rpc.mainnet.chain.robinhood.com')).toBe(false)
    expect(isLocalRpc(undefined)).toBe(false)
  })
  it('accepts only unsigned integer strings', () => {
    expect(uintOrNull('123')).toBe('123')
    expect(uintOrNull('1e18')).toBeNull()
    expect(uintOrNull('12 # x')).toBeNull()
    expect(uintOrNull(undefined)).toBeNull()
  })
})
