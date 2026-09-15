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
  await expect(rows).toHaveCount(10)
  await expect(rows.nth(0)).toContainText('1.023222')
  await expect(rows.nth(2)).toContainText('Held · timelock')
})

test('token page renders content from token.json', async ({ page }) => {
  await page.goto('/token')
  await expect(page.locator('body')).toContainText('$43,960')
  await expect(page.locator('body')).toContainText('12,418,300')
  await expect(page.locator('#ca')).toContainText('coming soon')
  await expect(page.locator('footer a', { hasText: 'X' })).toHaveAttribute('href', 'https://x.com/Halvefinance')
})

test('404, robots, sitemap, icon, api', async ({ page, request }) => {
  const nf = await page.goto('/nope')
  expect(nf?.status()).toBe(404)
  await expect(page.locator('h1')).toHaveText('Nothing to split here.')
  expect((await request.get('/robots.txt')).ok()).toBe(true)
  expect((await request.get('/sitemap.xml')).ok()).toBe(true)
  expect((await request.get('/icon.svg')).ok()).toBe(true)
  const api = await request.get('/api/yt-history/SCHD-MAR27')
  expect([200, 503]).toContain(api.status()) // 503 until KV is configured
  expect((await request.get('/api/yt-history/NOPE')).status()).toBe(404)
})

test('security headers are set', async ({ request }) => {
  const r = await request.get('/')
  expect(r.headers()['x-frame-options']).toBe('DENY')
  expect(r.headers()['content-security-policy']).toContain("frame-ancestors 'none'")
  expect(r.headers()['x-content-type-options']).toBe('nosniff')
})

test('docs page renders lifecycle, maths and the contracts table from series.json', async ({ page }) => {
  await page.goto('/docs')
  await expect(page.locator('h2')).toContainText('How Halve works')
  await expect(page.locator('#contracts')).toBeVisible()
  await expect(page.locator('#ctable tbody tr')).toHaveCount(10)
  await expect(page.locator('.prose')).toContainText('not deployed')
  await expect(page.locator('#security')).toBeVisible()
  await expect(page.locator('nav .links a', { hasText: 'Docs' })).toHaveAttribute('href', '/docs')
  await expect(page.locator('footer a', { hasText: 'Contracts' })).toHaveAttribute('href', '/docs#contracts')
})

test('legal pages exist and are linked from the footer and the wallet modal', async ({ page }) => {
  for (const [path, title] of [['/legal/terms', 'Terms of Use'], ['/legal/privacy', 'Privacy Notice'], ['/legal/risk', 'Risk Disclosure']] as const) {
    await page.goto(path)
    await expect(page.locator('h2')).toHaveText(title)
    await expect(page.locator('footer a', { hasText: title === 'Privacy Notice' ? 'Privacy' : title === 'Risk Disclosure' ? 'Risk disclosure' : title })).toHaveAttribute('href', path)
  }
  await page.goto('/app')
  await page.click('#wbtn')
  await expect(page.locator('#wlegal a', { hasText: 'Terms of Use' })).toHaveAttribute('href', '/legal/terms')
  await expect(page.locator('#wlegal a', { hasText: 'Risk Disclosure' })).toHaveAttribute('href', '/legal/risk')
})

test('geo-block: a US country header redirects /app and /lend to /restricted, other countries and no header pass', async ({ request, page }) => {
  const us = await request.get('/app', { headers: { 'cf-ipcountry': 'US' }, maxRedirects: 0 })
  expect(us.status()).toBe(307)
  expect(us.headers()['location']).toContain('/restricted?from=%2Fapp')
  expect((await request.get('/lend', { headers: { 'x-vercel-ip-country': 'us' }, maxRedirects: 0 })).status()).toBe(307)
  expect((await request.get('/app', { headers: { 'cf-ipcountry': 'DE' }, maxRedirects: 0 })).status()).toBe(200)
  expect((await request.get('/app', { maxRedirects: 0 })).status()).toBe(200)
  expect((await request.get('/', { headers: { 'cf-ipcountry': 'US' }, maxRedirects: 0 })).status()).toBe(200) // marketing pages stay open
  expect((await request.get('/oracle', { headers: { 'cf-ipcountry': 'US' }, maxRedirects: 0 })).status()).toBe(200)
  await page.goto('/restricted')
  await expect(page.locator('h2')).toContainText("isn't available in your region")
})

test('health endpoint reports mock mode and series counts', async ({ request }) => {
  const r = await request.get('/api/health')
  expect(r.status()).toBe(200)
  const j = await r.json()
  expect(j.ok).toBe(true)
  expect(j.mock).toBe(true)
  expect(j.chainId).toBe(4663)
  expect(j.series.total).toBe(10)
  expect(r.headers()['cache-control']).toBe('no-store')
})
