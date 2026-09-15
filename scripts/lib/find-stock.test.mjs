import { describe, expect, it } from 'vitest'
import { findCandidates, pickCandidate, setEnvValue, symbolMatches } from './find-stock.mjs'

const A = '0x322F0929c4625eD5bAd873c95208D54E1c003b2d'
const B = '0x1111111111111111111111111111111111111111'

describe('find-stock', () => {
  it('matches the ticker itself or a one-letter suffix, case-insensitively', () => {
    expect(symbolMatches('JEPI', 'jepi')).toBe(true)
    expect(symbolMatches('JEPIx', 'JEPI')).toBe(true)
    expect(symbolMatches('JEPI-x', 'JEPI')).toBe(true)
    expect(symbolMatches('JEPIQ2', 'JEPI')).toBe(false)
    expect(symbolMatches('SPY', 'JEPI')).toBe(false)
  })
  it('reads a registry with per-chain deployments', () => {
    const json = { results: [
      { symbol: 'JEPI', name: 'JPMorgan Equity Premium Income', deployments: [{ chainId: 1, contractAddress: B }, { chainId: 4663, contractAddress: A }] },
      { symbol: 'SPY', deployments: [{ chainId: 4663, contractAddress: B }] },
    ] }
    const c = findCandidates(json, 'JEPI')
    expect(c).toEqual([{ symbol: 'JEPI', address: B, chainId: 1 }, { symbol: 'JEPI', address: A, chainId: 4663 }])
    expect(pickCandidate(c)).toMatchObject({ address: A })
  })
  it('reads chain ids from object keys and network names', () => {
    expect(pickCandidate(findCandidates({ JEPI: { symbol: 'JEPI', chains: { '4663': { address: A }, '1': { address: B } } } }, 'JEPI'))).toMatchObject({ address: A })
    expect(pickCandidate(findCandidates([{ ticker: 'JEPI', network: 'Robinhood Chain', token_address: A }], 'JEPI'))).toMatchObject({ address: A })
  })
  it('accepts a single address without chain info, refuses ambiguity', () => {
    expect(pickCandidate(findCandidates({ symbol: 'JEPI', address: A }, 'JEPI'))).toMatchObject({ address: A })
    const amb = pickCandidate(findCandidates([{ symbol: 'JEPI', address: A }, { symbol: 'JEPI', address: B }], 'JEPI'))
    expect(amb.ambiguous).toHaveLength(2)
    expect(pickCandidate(findCandidates({ symbol: 'SPY', address: A }, 'JEPI'))).toBeNull()
  })
  it('writes STOCK into an env file, replacing or appending', () => {
    expect(setEnvValue('A=1\nSTOCK=0xold\nB=2\n', 'STOCK', A)).toBe(`A=1\nSTOCK=${A}\nB=2\n`)
    expect(setEnvValue('A=1', 'STOCK', A)).toBe(`A=1\nSTOCK=${A}\n`)
  })
})
