import { expect, test, type Page } from '@playwright/test'

const text = (page: Page, sel: string) => page.locator(sel).first()

test.describe('/app (mock mode)', () => {
  test('defaults to JEPI, ticks the block counter and switches series', async ({ page }) => {
    await page.goto('/app')
    await expect(text(page, '#aTtl')).toHaveText('JEPI · Mar 2027')
    await expect(text(page, '#kApy')).toHaveText('8.3%')
    await expect(text(page, '#kYt')).toHaveText('0.041')
    await expect(text(page, '#blk')).toHaveText('block 4,812,337')
    await expect(text(page, '#blk')).not.toHaveText('block 4,812,337', { timeout: 6000 })
    await page.click('#ss0')
    await page.waitForURL(/s=0/)
    await expect(text(page, '#aTtl')).toHaveText('SGOV · Mar 2027')
    await expect(page.locator('#ledger tr')).toHaveCount(6)
  })

  test('O shows the held special dividend on top of the ledger', async ({ page }) => {
    await page.goto('/app?s=2')
    const first = page.locator('#ledger tr').first()
    await expect(first).toContainText('Special dividend')
    await expect(first).toContainText('Held · timelock 1d 06h')
    await expect(first).toContainText('pending')
  })

  test('split / merge / earn quotes follow the prototype maths', async ({ page }) => {
    await page.goto('/app?s=1')
    await page.fill('#amt', '2.5')
    await expect(text(page, '#o1')).toHaveText('2.498 pJEPI')
    await expect(text(page, '#o2')).toHaveText('2.498 yJEPI')
    await expect(text(page, '#meta')).toContainText('0.0025 JEPI (0.10%)')
    await expect(text(page, '#go')).toHaveText('Connect wallet')
    await page.click('#tMerge')
    await expect(text(page, '#inLbl')).toHaveText('You merge')
    await expect(text(page, '#inAsset')).toHaveText('pJEPI + yJEPI')
    await expect(text(page, '#meta')).toContainText('0 · free')
    await page.click('#tEarn')
    await expect(text(page, '#o1')).toHaveText('1.249 LP')
    await expect(text(page, '#sideNote')).toContainText('% APR')
    await expect(page.locator('#tRedeem')).toHaveCount(0) // not matured
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
    await expect(page.locator('#wmodal .wopt')).toContainText(['MetaMask', 'Rabby', 'Demo wallet'])
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
    await expect(text(page, '#go')).toHaveText('Split 1 JEPI')

    await page.fill('#amt', '2')
    await page.click('#go')
    await expect(page.locator('#toast')).toHaveText('Split 2 JEPI → pJEPI + yJEPI')
    await expect(page.locator('#pos')).toContainText('1.998')
    await expect(page.locator('#pos')).toContainText('Accrued dividends')
    await expect(page.locator('#pos')).toContainText('Redeems at maturity')

    await page.fill('#amt', '50')
    await expect(text(page, '#go')).toHaveText('Insufficient JEPI')
    await expect(text(page, '#go')).toBeDisabled()
    await page.fill('#amt', '0')
    await expect(text(page, '#go')).toHaveText('Enter an amount')

    await page.click('#tMerge')
    await expect(text(page, '#bal')).toHaveText('2.00') // min(pt, yt) = 1.998 → 2 dp
    await page.locator('#bal ~ button', { hasText: 'Max' }).click()
    await expect(page.locator('#amt')).toHaveValue('1.998')
    await page.click('#go')
    await expect(page.locator('#toast')).toHaveText('Merged into 1.998 JEPI')
    await expect(page.locator('#pos')).toContainText('Nothing yet')

    await page.click('#tEarn')
    await page.fill('#amt', '1')
    await page.click('#go')
    await expect(page.locator('#toast')).toHaveText('Provided 1 JEPI to both pools')
    await expect(page.locator('#pos')).toContainText('LP')

    await page.locator('.appbar a', { hasText: 'Portfolio' }).click() // client-side nav keeps wallet + demo state
    await page.waitForURL(/tab=portfolio/)
    await expect(page.locator('#portfolio')).toContainText('JEPI · Mar 2027')
    await expect(page.locator('#portfolio')).toContainText('0.999')

    await page.reload() // demo position survives a refresh (sessionStorage); wallet reconnects via the modal
    await page.click('#wbtn')
    await page.click('#wdemo')
    await expect(page.locator('#portfolio')).toContainText('0.999')
  })
})
