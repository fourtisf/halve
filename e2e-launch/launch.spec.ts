import { expect, test } from '@playwright/test'

/**
 * MOCK=false, every series still at 0x000…, market feed off (see scripts/e2e-launch.mjs): the site as a live
 * host serves it before the first deployment. Nothing from the prototype may leak through.
 */

/** A wallet extension stand-in, already on chain 4663, so the connected state can be checked without an RPC. */
const FAKE_PROVIDER = `
(() => {
  const listeners = {};
  let approved = false;
  const provider = {
    isMetaMask: false, isRabby: true,
    request: async ({ method, params }) => {
      switch (method) {
        case 'eth_requestAccounts': approved = true; return ['0x1111111111111111111111111111111111111111'];
        case 'eth_accounts': return approved ? ['0x1111111111111111111111111111111111111111'] : [];
        case 'eth_chainId': return '0x1237';
        case 'net_version': return '4663';
        case 'wallet_switchEthereumChain': case 'wallet_addEthereumChain': return null;
        case 'eth_getBalance': return '0x0';
        case 'wallet_getPermissions': case 'wallet_requestPermissions': return [{ parentCapability: 'eth_accounts' }];
        default: throw Object.assign(new Error('unsupported: ' + method), { code: 4200 });
      }
    },
    on: (ev, fn) => { (listeners[ev] ||= []).push(fn); },
    removeListener: (ev, fn) => { listeners[ev] = (listeners[ev] || []).filter((f) => f !== fn); },
  };
  window.ethereum = provider;
})();
`

/** What a visit in mock mode leaves behind in the tab: a demo position, a demo split and a demo order. */
const DEMO_SESSION = JSON.stringify({
  pos: { SCHD: { pt: 5, yt: 5, lp: 1 } },
  log: [{ id: 'SCHD-MAR27', ticker: 'SCHD', action: 'Split', ts: 1_760_000_000, amount: 5, base: 4.995, seq: 0 }],
  orders: [{ id: 'demo-1', ticker: 'SCHD', token: 'pt', side: 'buy', price: 0.9, amount: 10, ts: 1_760_000_000 }],
})

test.describe('live build, nothing deployed', () => {
  test('demo state left in the tab by mock mode never shows as a real position, order or transaction', async ({ page }) => {
    await page.addInitScript(([key, value]) => { sessionStorage.setItem(key, value) }, ['halve:mock:v2', DEMO_SESSION])
    await page.addInitScript(FAKE_PROVIDER)
    await page.goto('/app?s=1')
    await page.click('#wbtn')
    await page.click('#wmodal .wopt[data-wallet="rabby"]')
    await expect(page.locator('#wbtn')).toHaveText('0x1111…1111')
    await expect(page.locator('#pos')).toContainText('Nothing yet')
    await expect(page.locator('#bal').first()).toHaveText('0.00')
    await expect(page.locator('#orders')).toContainText('No orders')
    await expect(page.locator('#go').first()).toHaveText('Opens at launch')
    expect(await page.evaluate(() => sessionStorage.getItem('halve:mock:v2'))).toBeNull() // dropped, not just hidden
    await page.locator('.appbar a', { hasText: 'Portfolio' }).click()
    await page.waitForURL(/tab=portfolio/)
    await expect(page.locator('#portfolio')).toContainText('Nothing yet')
    await expect(page.locator('#activity h4')).toContainText('0 transactions')
  })

  test('/app: default series, nothing invented, every action closed, no Earn, no demo wallet', async ({ page }) => {
    await page.goto('/app')
    await expect(page.locator('#aTtl').first()).toHaveText('SCHD · Mar 2027')
    await expect(page.locator('.banner.y')).toContainText('SCHD is not deployed yet')
    await expect(page.locator('#kTvl .skel')).toHaveCount(1) // no number, not the demo's $6.2M
    await expect(page.locator('#kApy .skel')).toHaveCount(1)
    await expect(page.locator('#ledger tr').first()).toContainText('No events yet this term')
    await expect(page.locator('#line')).not.toHaveAttribute('d', /M/) // no demo chart
    await expect(page.locator('#go').first()).toHaveText('Opens at launch')
    await expect(page.locator('#go').first()).toBeDisabled()
    await expect(page.locator('#sideNote')).toContainText('has not been deployed')
    await expect(page.locator('#tEarn')).toHaveCount(0)
    await expect(page.locator('.appbar a', { hasText: 'Earn' })).toHaveCount(0)
    await expect(page.locator('#bal').first()).toHaveText('0.00')
    await page.click('#wbtn')
    await expect(page.locator('#wmodal')).toHaveClass(/open/)
    await expect(page.locator('#wdemo')).toHaveCount(0)
    await page.keyboard.press('Escape')
    await page.goto('/app?tab=earn') // the demo-only tab falls back to Trade
    await expect(page.locator('#tBuy')).toHaveClass(/on/)
    await expect(page.locator('.appbar a.on')).toHaveText('Trade')
  })

  test('home: launching, no TVL, no yields, markets listed without numbers', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('.hero .eyebrow')).toHaveText('Launching on Robinhood Chain · Open source')
    await expect(page.locator('#sTvl')).toHaveText('—')
    await expect(page.locator('.stats')).toContainText('series in preview')
    await expect(page.locator('#hTopApy')).toContainText('—')
    await expect(page.locator('#hTopLev')).toContainText('—')
    const rows = page.locator('#mkt tr')
    await expect(rows).toHaveCount(10)
    await expect(rows.first().locator('.skel').first()).toBeVisible()
    await expect(rows.first()).toContainText('0%') // capacity used: nothing split
  })

  test('lend, token, oracle and health invent nothing', async ({ page, request }) => {
    await page.goto('/lend')
    await expect(page.locator('.banner.y')).toContainText('No lending market is open yet')
    await expect(page.locator('#lendMk .mk')).toHaveCount(3)
    await expect(page.locator('#lendMk .mk button').first()).toHaveText('Market not open yet')
    await expect(page.locator('#lendMk .mk button').first()).toBeDisabled()
    await expect(page.locator('#lendMk')).not.toContainText('$')
    await page.goto('/token')
    await expect(page.locator('#ca')).toContainText('coming soon')
    await expect(page.locator('.tok .rev b').first()).toHaveText('—')
    await expect(page.locator('.tok')).toContainText('Planned: stakers pay 5 bps')
    await page.goto('/oracle')
    await expect(page.locator('#orc tr')).toHaveCount(10)
    await expect(page.locator('#orc tr').first()).toContainText('Synced')
    await expect(page.locator('#orc tr').first()).toContainText('0 events')
    const h = await (await request.get('/api/health')).json()
    expect(h).toMatchObject({ ok: true, mock: false, chainId: 4663, series: { live: 0, ids: [] } })
    expect(h.rpc.ok).toBe(false) // the closed port: a live host reports its real RPC here
  })
})
