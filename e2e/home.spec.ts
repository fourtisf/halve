import { expect, test } from '@playwright/test'

test.describe('home (mock mode)', () => {
  test('renders hero, stats and the markets table sorted by APY', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('h1')).toContainText('Lock in a fixed yield')
    await expect(page.locator('#hTopApy')).toContainText('8.3%')
    await expect(page.locator('#hTopLev')).toContainText('24×')
    await expect(page.locator('#sTvl')).toHaveText('$25.4M')
    const rows = page.locator('#mkt tr')
    await expect(rows).toHaveCount(12)
    await expect(rows.first()).toContainText('JEPI')
    await expect(rows.nth(1)).toContainText('O')
  })

  test('market rows open the series, by click and by keyboard', async ({ page }) => {
    await page.goto('/')
    await page.locator('#mkt tr').nth(1).click()
    await page.waitForURL(/\/app\?s=2/)
    await expect(page.locator('#aTtl')).toHaveText('O · Mar 2027')
    await page.goto('/')
    await page.locator('#mkt tr').first().focus()
    await page.keyboard.press('Enter')
    await page.waitForURL(/\/app\?s=1/)
  })

  test('footer disclaimer is verbatim and FAQ has no claim button', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('footer')).toContainText("Yield tokens are a claim on the issuer's declared dividend reinvestment, not on the underlying equity. Not investment advice. Not available where the underlying stock tokens are not available.")
    await expect(page.getByRole('button', { name: /claim/i })).toHaveCount(0)
  })
})
