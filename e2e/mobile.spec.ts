import { expect, test } from '@playwright/test'

test('mobile: menu toggles links, app layout stacks, markets table scrolls', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('#navlinks')).toBeHidden()
  await page.click('#menubtn')
  await expect(page.locator('#mobilelinks')).toBeVisible()
  const [panel, hero] = await Promise.all([page.locator('#mobilelinks').boundingBox(), page.locator('.hero .eyebrow').boundingBox()])
  expect(hero!.y).toBeGreaterThanOrEqual(panel!.y + panel!.height) // menu pushes content down, never overlaps it
  await page.locator('#mobilelinks a', { hasText: 'App' }).click()
  await page.waitForURL(/\/app/)
  await expect(page.locator('#mobilelinks')).toBeHidden()
  const [left, right] = await Promise.all([page.locator('.applay > div').nth(0).boundingBox(), page.locator('.applay > div').nth(1).boundingBox()])
  expect(right!.y).toBeGreaterThan(left!.y + left!.height - 1)
  await page.goto('/')
  const card = page.locator('#markets .card')
  const overflow = await card.evaluate((el) => el.scrollWidth > el.clientWidth)
  expect(overflow).toBe(true)
  const bodyOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
  expect(bodyOverflow).toBe(false)
})

test('mobile without an extension offers "open in wallet app" deep links', async ({ page }) => {
  await page.goto('/app')
  await page.click('#wbtn')
  const apps = page.locator('#wapps a')
  await expect(apps).toHaveCount(5)
  await expect(page.locator('#wapps a[data-app="metamask"]')).toHaveAttribute('href', /metamask\.app\.link\/dapp\/localhost:3000\/app/)
  await expect(page.locator('#wapps a[data-app="trust"]')).toHaveAttribute('href', /link\.trustwallet\.com\/open_url\?coin_id=60&url=/)
  await expect(page.locator('#wapps a[data-app="coinbase"]')).toHaveAttribute('href', /go\.cb-w\.com\/dapp\?cb_url=/)
})
