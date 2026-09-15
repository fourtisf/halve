import { expect, test, type Page } from '@playwright/test'

/**
 * Preview mode: the demo build (no contracts) with the market feed on. Quotes come from LIVE_MARKET=fixture
 * (the demo table's price and yield), so the numbers are deterministic while the UI takes the same path it
 * takes with Yahoo / Stooq on the real host.
 */
const text = (page: Page, sel: string) => page.locator(sel).first()

test('the market API serves fixture quotes and health reports it', async ({ request }) => {
  const m = await (await request.get('/api/market')).json()
  expect(m).toMatchObject({ ok: true, source: 'fixture', stale: false, ethUsd: 4000 })
  expect(m.quotes.SCHD.price).toBe(28.9)
  expect(m.quotes.SCHD.trailingYield).toBe(0.078)
  expect(m.quotes.SCHD.closes30d).toHaveLength(31)
  expect(m.quotes.AMZN.trailingYield).toBe(0)
  const h = await (await request.get('/api/health')).json()
  expect(h.market).toMatchObject({ on: true })
})

test('app: real price and yield, indicative PT / YT, nothing invented for TVL or dividends', async ({ page }) => {
  await page.goto('/app?s=1') // SCHD
  await expect(page.locator('.banner.y')).toContainText('Preview · real share price and trailing dividend yield')
  await expect(text(page, '#kTvl')).toHaveText('—')
  await expect(text(page, '#kTvl ~ em')).toHaveText('opens at launch')
  // 7.8 % trailing yield over the time left to Mar 2027 → YT a few cents of a share, PT just under par, APY ≈ the yield
  await expect(text(page, '#kYt')).toHaveText(/^0\.0\d\d$/)
  await expect(text(page, '#kYtChg')).toHaveText('indicative · in stock')
  await expect(text(page, '#kApy')).toHaveText(/^[7-9]\.\d%$/)
  await expect(text(page, '#kAcc')).toHaveText('—')
  await expect(text(page, '#kEv')).toHaveText('from launch')
  await expect(page.locator('#ledger tr').first()).toContainText('No events yet this term') // no accountant, no demo rows
  await expect(text(page, '#chLbl')).toHaveText('SCHD · 30d · share price')
  await expect(page.locator('#line')).toHaveAttribute('d', /^M0\.0,.* L600\.0,/)
  // the buy cards read the same numbers
  await expect(page.locator('#buySide button.pt')).toContainText(/Buy pSCHD for 9[5-9]% of a share/)
  await expect(page.locator('#buySide button.yt')).toContainText(/^Dividends only[0-9.]+%of a share/)
  // demo wallet buy still works, priced off the quote: 0.1 ETH × $4,000 / $28.90 ≈ 13.84 SCHD of PT at ~0.96–0.99
  await page.click('#wbtn')
  await page.click('#wdemo')
  await page.fill('#amt', '0.1')
  await expect(text(page, '#o1')).toHaveText(/^1[34]\.\d{4} pSCHD$/)
  await expect(text(page, '#go')).toHaveText('Buy pSCHD')
})

test('a non-payer prices at par: AMZN has no yield, so YT is worthless and PT is a full share', async ({ page }) => {
  await page.goto('/app?s=6') // AMZN
  await expect(text(page, '#kApy')).toHaveText('0.0%')
  await expect(text(page, '#kYt')).toHaveText('0.000')
  await expect(page.locator('#buySide button.pt')).toContainText('Buy pAMZN for 100% of a share')
})

test('home: stats strip says preview, markets sort by the real yields, nothing shows as split', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('#sTvl')).toHaveText('—')
  await expect(page.locator('.stats')).toContainText('series in preview')
  await expect(page.locator('#hTopApy')).toContainText(/^[7-9]\.\d%/) // SCHD, the highest trailing yield
  const rows = page.locator('#mkt tr')
  await expect(rows).toHaveCount(10)
  await expect(rows.first()).toContainText('SCHD')
  await expect(rows.first()).toContainText('7.8%') // dividend yield column = trailing yield
  await expect(rows.last()).toContainText(/AMZN|TSLA/)
})
