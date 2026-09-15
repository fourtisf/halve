import { expect, test, type Page } from '@playwright/test'

const text = (page: Page, sel: string) => page.locator(sel).first()

test.describe('/app (mock mode)', () => {
  test('defaults to SCHD, ticks the block counter and switches series', async ({ page }) => {
    await page.goto('/app')
    await expect(text(page, '#aTtl')).toHaveText('SCHD · Mar 2027')
    await expect(text(page, '#kApy')).toHaveText('8.3%')
    await expect(text(page, '#kYt')).toHaveText('0.041')
    await expect(text(page, '#blk')).toHaveText('block 4,812,337')
    await expect(text(page, '#blk')).not.toHaveText('block 4,812,337', { timeout: 6000 })
    await page.click('#ss0')
    await page.waitForURL(/s=0/)
    await expect(text(page, '#aTtl')).toHaveText('SGOV · Mar 2027')
    await expect(page.locator('#ledger tr')).toHaveCount(6)
  })

  test('SPY shows the held special dividend on top of the ledger', async ({ page }) => {
    await page.goto('/app?s=2')
    const first = page.locator('#ledger tr').first()
    await expect(first).toContainText('Special dividend')
    await expect(first).toContainText('Held · timelock 1d 06h')
    await expect(first).toContainText('pending')
  })

  test('split / merge / earn quotes follow the prototype maths', async ({ page }) => {
    await page.goto('/app?s=1')
    await page.fill('#amt', '2.5')
    await expect(text(page, '#o1')).toHaveText('2.498 pSCHD')
    await expect(text(page, '#o2')).toHaveText('2.498 ySCHD')
    await expect(text(page, '#meta')).toContainText('0.0025 SCHD (0.10%)')
    await expect(text(page, '#go')).toHaveText('Connect wallet')
    await page.click('#tMerge')
    await expect(text(page, '#inLbl')).toHaveText('You merge')
    await expect(text(page, '#inAsset')).toHaveText('pSCHD + ySCHD')
    await expect(text(page, '#meta')).toContainText('0 · free')
    await page.click('#tEarn')
    await expect(text(page, '#o1')).toHaveText('1.249 LP')
    await expect(text(page, '#sideNote')).toContainText('% APR')
    await expect(page.locator('#tRedeem')).toHaveCount(0) // not matured
  })

  test('buy tab: quotes PT/YT for ETH or the stock and the demo wallet can buy', async ({ page }) => {
    await page.goto('/app?s=1&tab=buy')
    await expect(page.locator('#tBuy')).toHaveClass(/on/)
    await expect(page.locator('.appbar a.on')).toHaveText('Buy')
    await expect(text(page, '#inLbl')).toHaveText('You pay')
    await expect(text(page, '#inAsset')).toHaveText('ETH')
    await page.fill('#amt', '0.1')
    // 0.1 ETH × $4,000 / $28.90 = 13.841 SCHD → / 0.9587 PT price × (1 − 0.3 % fee)
    await expect(text(page, '#o1')).toHaveText(/^14\.39\d\d pSCHD$/)
    await expect(text(page, '#route')).toHaveText('ETH → SCHD → pSCHD')
    await page.locator('#buySide button', { hasText: 'Buy ySCHD' }).click()
    await expect(text(page, '#o1')).toHaveText(/ySCHD$/)
    await page.locator('#payWith button', { hasText: 'Pay with SCHD' }).click()
    await expect(text(page, '#inAsset')).toHaveText('SCHD')
    await page.fill('#amt', '1')
    await expect(text(page, '#o1')).toHaveText(/^24\.1\d\d\d ySCHD$/) // 1 / 0.0413 × 0.997
    await expect(text(page, '#go')).toHaveText('Connect wallet')
    await page.click('#wbtn')
    await page.click('#wdemo')
    await expect(text(page, '#go')).toHaveText('Buy ySCHD')
    await page.click('#go')
    await expect(page.locator('#toast')).toHaveText(/^Bought 24\.1\d+ ySCHD with 1 SCHD$/)
    await expect(page.locator('#pos')).toContainText('ySCHD')
  })

  test('url params pick tab and side', async ({ page }) => {
    await page.goto('/app?tab=earn')
    await expect(page.locator('#tEarn')).toHaveClass(/on/)
    await expect(page.locator('.appbar a.on')).toHaveText('Earn')
    await page.goto('/app?s=1&side=yt')
    await expect(page.locator('#tSplit')).toHaveClass(/on/)
  })

  test('wallet modal opens from nav and from the action button, traps focus, closes on Escape', async ({ page }) => {
    await page.goto('/app')
    await page.click('#wbtn')
    await expect(page.locator('#wmodal')).toHaveClass(/open/)
    await expect(page.locator('#wmodal .wopt').first()).toBeFocused()
    for (const name of ['MetaMask', 'Rabby', 'Coinbase Wallet', 'Trust Wallet', 'OKX Wallet', 'Phantom', 'Rainbow', 'Binance Wallet', 'Demo wallet']) {
      await expect(page.locator('#wmodal .wopt', { hasText: name })).toHaveCount(1)
    }
    await expect(page.locator('#wmodal .wicon img').first()).toHaveAttribute('src', /^data:image/)
    await page.keyboard.press('Escape')
    await expect(page.locator('#wmodal')).not.toHaveClass(/open/)
    await page.click('#go')
    await expect(page.locator('#wmodal')).toHaveClass(/open/)
  })

  test('demo wallet: connect, split, position, merge, validation, earn, portfolio', async ({ page }) => {
    await page.goto('/app?s=1')
    await page.click('#wbtn')
    await page.click('#wdemo')
    await expect(page.locator('#toast')).toHaveText('Connected with Demo wallet')
    await expect(page.locator('#wbtn')).toHaveText('0x7A3f…C32F')
    await expect(text(page, '#bal')).toHaveText('12.40')
    await expect(text(page, '#go')).toHaveText('Split 1 SCHD')

    await page.fill('#amt', '2')
    await page.click('#go')
    await expect(page.locator('#toast')).toHaveText('Split 2 SCHD → pSCHD + ySCHD')
    await expect(page.locator('#pos')).toContainText('1.998')
    await expect(page.locator('#pos')).toContainText('Accrued dividends')
    await expect(page.locator('#pos')).toContainText('Redeems at maturity')

    await page.fill('#amt', '50')
    await expect(text(page, '#go')).toHaveText('Insufficient SCHD')
    await expect(text(page, '#go')).toBeDisabled()
    await page.fill('#amt', '0')
    await expect(text(page, '#go')).toHaveText('Enter an amount')

    await page.click('#tMerge')
    await expect(text(page, '#bal')).toHaveText('2.00') // min(pt, yt) = 1.998 → 2 dp
    await page.locator('#bal ~ button', { hasText: 'Max' }).click()
    await expect(page.locator('#amt')).toHaveValue('1.998')
    await page.click('#go')
    await expect(page.locator('#toast')).toHaveText('Merged into 1.998 SCHD')
    await expect(page.locator('#pos')).toContainText('Nothing yet')

    await page.click('#tEarn')
    await page.fill('#amt', '1')
    await page.click('#go')
    await expect(page.locator('#toast')).toHaveText('Provided 1 SCHD to both pools')
    await expect(page.locator('#pos')).toContainText('LP')

    await page.locator('.appbar a', { hasText: 'Portfolio' }).click() // client-side nav keeps wallet + demo state
    await page.waitForURL(/tab=portfolio/)
    await expect(page.locator('#portfolio')).toContainText('SCHD · Mar 2027')
    await expect(page.locator('#portfolio')).toContainText('0.999')
    // activity log + PnL from the demo session: split 2, merge 1.998, earn 1
    await expect(page.locator('#activity h4')).toContainText('2 transactions · demo')
    await expect(page.locator('#activity .act tbody tr')).toHaveCount(2)
    await expect(page.locator('#activity .act tbody tr').first()).toContainText('Merge')
    await expect(page.locator('#activity .act tbody tr').last()).toContainText('Split')
    await expect(page.locator('#pnl')).toContainText('2.0000') // deposited

    await page.reload() // demo position survives a refresh (sessionStorage); wallet reconnects via the modal
    await page.click('#wbtn')
    await page.click('#wdemo')
    await expect(page.locator('#portfolio')).toContainText('0.999')
  })
})
