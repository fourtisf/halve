import { expect, test } from '@playwright/test'

test('lend shows three Morpho markets and toasts', async ({ page }) => {
  await page.goto('/lend')
  await expect(page.locator('#lendMk .mk')).toHaveCount(3)
  await expect(page.locator('#lendMk .mk').nth(2)).toContainText('held')
  await page.locator('#lendMk .mk button').first().click()
  await expect(page.locator('#toast')).toHaveText('Opening Morpho market for pSGOV')
})

test('oracle table lists every series with status and index', async ({ page }) => {
  await page.goto('/oracle')
  const rows = page.locator('#orc tr')
  await expect(rows).toHaveCount(12)
  await expect(rows.nth(0)).toContainText('1.023222')
  await expect(rows.nth(2)).toContainText('Held · timelock')
})

test('token page renders content from token.json', async ({ page }) => {
  await page.goto('/token')
  await expect(page.locator('body')).toContainText('$43,960')
  await expect(page.locator('body')).toContainText('12,418,300')
})

test('404, robots, sitemap, icon, api', async ({ page, request }) => {
  const nf = await page.goto('/nope')
  expect(nf?.status()).toBe(404)
  await expect(page.locator('h1')).toHaveText('Nothing to split here.')
  expect((await request.get('/robots.txt')).ok()).toBe(true)
  expect((await request.get('/sitemap.xml')).ok()).toBe(true)
  expect((await request.get('/icon.svg')).ok()).toBe(true)
  const api = await request.get('/api/yt-history/JEPI-MAR27')
  expect([200, 503]).toContain(api.status()) // 503 until KV is configured
  expect((await request.get('/api/yt-history/NOPE')).status()).toBe(404)
})

test('security headers are set', async ({ request }) => {
  const r = await request.get('/')
  expect(r.headers()['x-frame-options']).toBe('DENY')
  expect(r.headers()['content-security-policy']).toContain("frame-ancestors 'none'")
  expect(r.headers()['x-content-type-options']).toBe('nosniff')
})
