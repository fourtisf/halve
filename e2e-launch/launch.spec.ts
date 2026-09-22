import { expect, test } from '@playwright/test'

/**
 * MOCK=false, every series still at 0x000…, market feed off (see scripts/e2e-launch.mjs): the site as a live
 * host serves it before the first deployment. Nothing from the prototype may leak through.
 */
test.describe('live build, nothing deployed', () => {
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
