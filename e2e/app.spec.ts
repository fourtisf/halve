import { expect, test, type Page } from '@playwright/test'

const text = (page: Page, sel: string) => page.locator(sel).first()

test.describe('/app (mock mode)', () => {
  test('defaults to SCHD, ticks the block counter and switches series', async ({ page }) => {
    await page.goto('/app')
    await expect(text(page, '#aTtl')).toHaveText('SCHD · Mar 2027')
    await expect(page.locator('#tBuy')).toHaveClass(/on/) // Buy is the front door
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
    await page.goto('/app?s=1&tab=split')
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
    await expect(page.locator('.appbar a.on')).toHaveText('Trade')
    await expect(text(page, '#inLbl')).toHaveText('You pay')
    await expect(text(page, '#inAsset')).toHaveText('ETH')
    await expect(page.locator('#amt')).toHaveValue('0.1')
    // plain-language choice cards: fixed return (PT) is selected first, dividends only (YT) is the other
    await expect(page.locator('#buySide button.pt')).toHaveClass(/on/)
    await expect(page.locator('#buySide button.pt')).toContainText('8.3%')
    await expect(page.locator('#buySide button.pt')).toContainText('In Mar 2027 it becomes 1 full SCHD')
    await expect(page.locator('#buySide button.yt')).toContainText('4.1%')
    await expect(page.locator('.step')).toHaveCount(4)
    await expect(page.locator('#howto summary')).toHaveText('New to this? Three steps')
    await expect(page.locator('#howto a')).toHaveAttribute('href', 'https://docs.robinhood.com/chain/bridging/')
    await page.fill('#amt', '0.1')
    // 0.1 ETH × $4,000 / $28.90 = 13.841 SCHD → / 0.9587 PT price × (1 − 0.3 % fee)
    await expect(text(page, '#o1')).toHaveText(/^14\.39\d\d pSCHD$/)
    await expect(text(page, '#route')).toHaveText('ETH → SCHD → pSCHD')
    await expect(text(page, '#buyLater')).toHaveText(/^14\.39\d\d SCHD$/) // a PT is one full share at maturity
    await page.locator('#buySide button', { hasText: 'Dividends only' }).click()
    await expect(text(page, '#o1')).toHaveText(/ySCHD$/)
    await expect(text(page, '#buyLater')).toHaveText('every SCHD dividend until Mar 2027')
    await page.locator('#payWith button', { hasText: 'SCHD' }).click()
    await expect(text(page, '#inAsset')).toHaveText('SCHD')
    await expect(page.locator('#amt')).toHaveValue('1') // amount resets to a sensible default for the new asset
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

  test('limit orders and selling (demo): validation, place, list, cancel, sell quotes', async ({ page }) => {
    await page.goto('/app?s=1&tab=buy')
    await page.locator('#payWith button', { hasText: 'SCHD' }).click()
    await page.locator('#orderType button', { hasText: 'Limit' }).click()
    await page.fill('#amt', '10')
    await page.fill('#limitPrice', '0.99') // above the market (PT trades at 0.9587)
    await expect(text(page, '#limitHint')).toContainText('must sit below the current price')
    await page.fill('#limitPrice', '0.9')
    await expect(text(page, '#limitHint')).toContainText(/fills between 0\.89\d\d and 0\.[89]\d\d\d SCHD/)
    await expect(text(page, '#o1')).toHaveText(/^11\.\d{4} pSCHD$/) // 10 SCHD at ≈ 0.897 → ≈ 11.15 pSCHD
    await expect(text(page, '#go')).toHaveText('Connect wallet')
    await page.click('#wbtn')
    await page.click('#wdemo')
    await expect(text(page, '#go')).toHaveText('Place limit buy')
    await page.click('#go')
    await expect(page.locator('#toast')).toHaveText(/^Order placed: Buy pSCHD at ≤ 0\.89\d\d SCHD$/)
    const row = page.locator('#orders .row').first()
    await expect(row).toContainText('Buy pSCHD at ≤ 0.89')
    await expect(row).toContainText('Open · waiting with 10.0000 SCHD')
    await row.locator('button', { hasText: 'Cancel' }).click()
    await expect(page.locator('#toast')).toHaveText('Order cancelled')
    await expect(page.locator('#orders')).toContainText('No orders')
    // sell side, market: 1 pSCHD → 0.9587 × 0.997 SCHD, or the same in ETH at $4,000
    await page.locator('#dir button', { hasText: 'Sell' }).click()
    await expect(text(page, '#inLbl')).toHaveText('You sell')
    await expect(text(page, '#inAsset')).toHaveText('pSCHD')
    await page.locator('#orderType button', { hasText: 'Market' }).click()
    await page.fill('#amt', '1')
    await expect(text(page, '#o1')).toHaveText(/^0\.955\d SCHD$/)
    await page.locator('#payWith button', { hasText: 'ETH' }).click()
    await expect(text(page, '#o1')).toHaveText('0.0069 ETH') // 0.9558 SCHD × $28.90 / $4,000
    await expect(text(page, '#go')).toHaveText('Insufficient pSCHD') // the demo wallet holds none yet
  })

  test('url params pick tab and side', async ({ page }) => {
    await page.goto('/app?tab=earn')
    await expect(page.locator('#tEarn')).toHaveClass(/on/)
    await expect(page.locator('.appbar a.on')).toHaveText('Earn')
    await page.goto('/app?s=1&side=yt') // "Buy YT" from the home page: Buy tab, dividends card selected
    await expect(page.locator('#tBuy')).toHaveClass(/on/)
    await expect(page.locator('#buySide button.yt')).toHaveClass(/on/)
    await expect(text(page, '#o1')).toHaveText(/ySCHD$/)
    await page.goto('/app?s=1&tab=split')
    await expect(page.locator('#tSplit')).toHaveClass(/on/)
    await expect(page.locator('.appbar a.on')).toHaveText('Split')
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
    await page.goto('/app?s=1&tab=split')
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
