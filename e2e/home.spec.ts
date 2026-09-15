import { expect, test } from '@playwright/test'

test.describe('home (mock mode)', () => {
  test('renders hero, stats and the markets table sorted by APY', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('h1')).toContainText('Lock in a fixed yield')
    await expect(page.locator('#hTopApy')).toContainText('8.3%')
    await expect(page.locator('#hTopLev')).toContainText('24×')
    await expect(page.locator('#sTvl')).toHaveText('$22.4M')
    const rows = page.locator('#mkt tr')
    await expect(rows).toHaveCount(10)
    await expect(rows.first()).toContainText('SCHD')
    await expect(rows.nth(1)).toContainText('SGOV')
  })

  test('market rows open the series, by click and by keyboard', async ({ page }) => {
    await page.goto('/')
    await page.locator('#mkt tr').nth(1).click()
    await page.waitForURL(/\/app\?s=0/)
    await expect(page.locator('#aTtl')).toHaveText('SGOV · Mar 2027')
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

  test('X is linked from the announcement bar, nav, CTA and footer; the bar can be dismissed and stays dismissed', async ({ page }) => {
    await page.goto('/')
    const x = 'https://x.com/Halvefinance'
    await expect(page.locator('#announceLink')).toHaveAttribute('href', x)
    await expect(page.locator('#announce')).toContainText('Follow @Halvefinance')
    await expect(page.locator('#xnav')).toHaveAttribute('href', x)
    await expect(page.locator('#xnav')).toHaveAttribute('target', '_blank')
    await expect(page.locator('#xcta')).toHaveAttribute('href', x)
    await expect(page.locator('#xfooter')).toHaveAttribute('href', x)
    await expect(page.locator('#xfooter')).toContainText('@Halvefinance')
    await expect(page.locator('.hero .eyebrow')).toHaveText('Live on Robinhood Chain · Open source')
    await page.click('#announceClose')
    await expect(page.locator('#announce')).toHaveCount(0)
    await page.reload()
    await expect(page.locator('#announce')).toHaveCount(0)
  })
})
