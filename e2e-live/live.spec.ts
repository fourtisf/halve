import { expect, test, type Page } from '@playwright/test'
import { createPublicClient, createWalletClient, http, parseAbi, parseEther, type Address } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

/**
 * Real transactions against the contracts on a local anvil (see scripts/e2e-live.mjs).
 * The browser wallet is a plain EIP-1193 provider that forwards every call to anvil; anvil signs for
 * its unlocked accounts, so approve / split / merge go through the same wagmi path as MetaMask would.
 */
const RPC = process.env.E2E_RPC ?? 'http://127.0.0.1:8545'
const SERIES = JSON.parse(process.env.E2E_SERIES ?? '{}') as { id: string; ticker: string; underlying: Address; vault: Address; accountant: Address }
const USER = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
const DEPLOYER = privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80')

const PROVIDER = `
(() => {
  const listeners = {};
  let approved = false;
  let id = 0;
  const provider = {
    isMetaMask: false,
    request: async ({ method, params }) => {
      switch (method) {
        case 'eth_requestAccounts': approved = true; return ['${USER}'];
        case 'eth_accounts': return approved ? ['${USER}'] : [];
        case 'wallet_switchEthereumChain':
        case 'wallet_addEthereumChain': return null;
        case 'wallet_getPermissions':
        case 'wallet_requestPermissions': return [{ parentCapability: 'eth_accounts' }];
        default: {
          const r = await fetch('${RPC}', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params: params ?? [] }) });
          const j = await r.json();
          if (j.error) throw Object.assign(new Error(j.error.message), { code: j.error.code, data: j.error.data });
          return j.result;
        }
      }
    },
    on: (ev, fn) => { (listeners[ev] ||= []).push(fn); },
    removeListener: (ev, fn) => { listeners[ev] = (listeners[ev] || []).filter((f) => f !== fn); },
  };
  window.ethereum = provider;
})();
`

const stockAbi = parseAbi(['function setUIMultiplier(uint256 m)', 'function uiMultiplier() view returns (uint256)', 'function balanceOf(address) view returns (uint256)'])
const acctAbi = parseAbi(['function sync()', 'function dividendIndex() view returns (uint256)'])
const vaultAbi = parseAbi(['function totalDeposits() view returns (uint256)'])

const pub = createPublicClient({ transport: http(RPC) })
const deployer = createWalletClient({ account: DEPLOYER, transport: http(RPC) })
const first = (page: Page, sel: string) => page.locator(sel).first()

async function connect(page: Page) {
  await page.addInitScript(PROVIDER)
  await page.goto('/app?s=0')
  await page.click('#wbtn')
  await page.click('#wmodal .wopt[data-wallet="injected"]')
  await expect(page.locator('#wbtn')).toHaveText('0x7099…79C8')
}

test.describe.serial('live chain', () => {
  test('reads the series from chain: KPIs, oracle and an empty ledger', async ({ page }) => {
    await page.goto('/app?s=0')
    const t = SERIES.ticker
    await expect(first(page, '#aTtl')).toContainText(t)
    await expect(first(page, '#kYt')).toHaveText('0.040') // MockV3Pool priced YT at 0.04 stock
    await expect(first(page, '#kAcc')).toHaveText('0.0%')
    await expect(first(page, '#kEv')).toHaveText('0 events')
    await expect(first(page, '#kTvl')).toHaveText('$570K') // 9,990 base units seeded into the pools × $57.10
    await expect(page.locator('#ledger tr').first()).toContainText('No events yet this term')
    await expect(first(page, '#blk')).toHaveText(/block \d/)
    await page.goto('/oracle')
    await expect(page.locator('#orc tr').first()).toContainText('Synced')
    // health reflects live mode against the local chain
    const h = await (await page.request.get('/api/health')).json()
    expect(h).toMatchObject({ ok: true, mock: false, chainId: 4663, series: { live: 1, ids: [SERIES.id] } })
    expect(h.rpc.ok).toBe(true)
    expect(h.rpc.block).toBeGreaterThan(0)
  })

  test('connect → approve + split → position from chain → merge', async ({ page }) => {
    await connect(page)
    const t = SERIES.ticker
    await expect(first(page, '#bal')).toHaveText('1,000.00')
    await expect(first(page, '#go')).toHaveText(`Split 1 ${t}`)

    await page.fill('#amt', '10')
    await expect(first(page, '#o1')).toHaveText(`9.990 p${t}`)
    await page.click('#go')
    await expect(page.locator('#toast')).toHaveText(`Split 10 ${t} → p${t} + y${t}`, { timeout: 30_000 })
    await expect(page.locator('#txlink')).toHaveAttribute('href', /blockscout\.com\/tx\/0x[0-9a-f]{64}$/)
    await expect(page.locator('#pos')).toContainText('9.990')
    await expect(first(page, '#bal')).toHaveText('990.00')
    expect(await pub.readContract({ address: SERIES.vault, abi: vaultAbi, functionName: 'totalDeposits' })).toBe(parseEther('9999.99')) // 9,990 seeded + 9.99

    await page.click('#tMerge')
    await expect(first(page, '#bal')).toHaveText('9.99')
    await page.fill('#amt', '4')
    await page.click('#go')
    await expect(page.locator('#toast')).toHaveText(`Merged into 4 ${t}`, { timeout: 30_000 })
    await expect(page.locator('#pos')).toContainText('5.990')
    expect(await pub.readContract({ address: SERIES.underlying, abi: stockAbi, functionName: 'balanceOf', args: [USER] })).toBe(parseEther('994'))

    // Portfolio → Activity: both transactions come back from the vault's events with explorer links
    await page.locator('.appbar a', { hasText: 'Portfolio' }).click()
    await page.waitForURL(/tab=portfolio/)
    await expect(page.locator('#portfolio')).toContainText('5.990')
    await expect(page.locator('#activity h4')).toContainText('2 transactions', { timeout: 30_000 })
    const acts = page.locator('#activity .act tbody tr')
    await expect(acts.first()).toContainText('Merge')
    await expect(acts.first()).toContainText('+4.0000')
    await expect(acts.last()).toContainText('Split')
    await expect(acts.first().locator('a')).toHaveAttribute('href', /blockscout\.com\/tx\/0x[0-9a-f]{64}$/)
    await expect(page.locator('#pnl')).toContainText('10.0000') // deposited
    await expect(page.locator('#pnl')).toContainText('4.0000') // withdrawn
  })

  test('a dividend on the stock token shows up in the ledger, KPIs and the position', async ({ page }) => {
    // issuer pays 0.65 %: the multiplier moves, a keeper syncs the accountant
    const m = await pub.readContract({ address: SERIES.underlying, abi: stockAbi, functionName: 'uiMultiplier' })
    let h = await deployer.writeContract({ address: SERIES.underlying, abi: stockAbi, functionName: 'setUIMultiplier', args: [(m * 10065n) / 10000n], chain: null })
    await pub.waitForTransactionReceipt({ hash: h })
    h = await deployer.writeContract({ address: SERIES.accountant, abi: acctAbi, functionName: 'sync', chain: null })
    await pub.waitForTransactionReceipt({ hash: h })
    expect(await pub.readContract({ address: SERIES.accountant, abi: acctAbi, functionName: 'dividendIndex' })).toBe(parseEther('1.0065'))

    await connect(page)
    await expect(first(page, '#kAcc')).toHaveText(/^0\.[67]%$/, { timeout: 30_000 }) // 0.65 % at 1 dp
    await expect(first(page, '#kEv')).toHaveText('1 events')
    const row = page.locator('#ledger tr').first()
    await expect(row).toContainText('Dividend')
    await expect(row).toContainText('1.00650')
    await expect(row).toContainText('Classified')
    // 5.99 yJEPI × (1 − 1/1.0065) × $57.10 ≈ $2.21: the YT's slice of the raw token
    await expect(page.locator('#pos')).toContainText('$2.21')
    // merging pays raw tokens 1:1; raw balances never rebase, the wallet shows 1.0065 shares per token
    await page.click('#tMerge')
    await page.fill('#amt', '1')
    await page.click('#go')
    await expect(page.locator('#toast')).toHaveText(/Merged into 1 /, { timeout: 30_000 })
    expect(await pub.readContract({ address: SERIES.underlying, abi: stockAbi, functionName: 'balanceOf', args: [USER] })).toBe(parseEther('995'))
  })
})
