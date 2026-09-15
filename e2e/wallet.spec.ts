import { expect, test } from '@playwright/test'

const ACCOUNT = '0x1111111111111111111111111111111111111111'

/** Minimal EIP-1193 provider injected before the app loads, flagged as Rabby so the Rabby option treats it as installed. */
const FAKE_PROVIDER = `
(() => {
  const listeners = {};
  let chainId = '0x1';
  let approved = false; // like a real wallet: no accounts exposed until the site is approved
  const provider = {
    isMetaMask: false,
    isRabby: true,
    request: async ({ method, params }) => {
      switch (method) {
        case 'eth_requestAccounts': approved = true; return ['${ACCOUNT}'];
        case 'eth_accounts': return approved ? ['${ACCOUNT}'] : [];
        case 'eth_chainId': return chainId;
        case 'net_version': return String(parseInt(chainId, 16));
        case 'wallet_switchEthereumChain': chainId = params[0].chainId; (listeners.chainChanged || []).forEach((f) => f(chainId)); return null;
        case 'wallet_addEthereumChain': return null;
        case 'eth_getBalance': return '0x0';
        case 'wallet_getPermissions':
        case 'wallet_requestPermissions': return [{ parentCapability: 'eth_accounts' }];
        default: throw Object.assign(new Error('unsupported: ' + method), { code: 4200 });
      }
    },
    on: (ev, fn) => { (listeners[ev] ||= []).push(fn); },
    removeListener: (ev, fn) => { listeners[ev] = (listeners[ev] || []).filter((f) => f !== fn); },
  };
  window.ethereum = provider;
})();
`

test.describe('real wallet connection path (fake injected provider)', () => {
  test('connects through the Rabby option, switches to chain 4663, shows the address and balance', async ({ page }) => {
    await page.addInitScript(FAKE_PROVIDER)
    await page.goto('/app?s=1&tab=split')
    await page.click('#wbtn')
    const rabby = page.locator('#wmodal .wopt[data-wallet="rabby"]')
    await expect(rabby).toContainText('Installed')
    await rabby.click()
    await expect(page.locator('#toast')).toHaveText('Connected with Rabby')
    await expect(page.locator('#wbtn')).toHaveText('0x1111…1111')
    await expect(page.locator('#wmodal')).not.toHaveClass(/open/)
    // ChainGuard switched the fake wallet from mainnet to Robinhood Chain, so the action button is live.
    await expect(page.locator('#go')).toHaveText('Split 1 SCHD')
    await expect(page.locator('#bal')).toHaveText('12.40') // mock balance until addresses are filled
  })

  test('connects through the generic browser-wallet option', async ({ page }) => {
    await page.addInitScript(FAKE_PROVIDER.replace('isRabby: true', 'isRabby: false'))
    await page.goto('/')
    await page.click('#wbtn')
    const injected = page.locator('#wmodal .wopt[data-wallet="injected"]')
    await expect(injected).toBeVisible()
    await injected.click()
    await expect(page.locator('#wbtn')).toHaveText('0x1111…1111')
  })

  test('without any extension the browser-wallet option is hidden and uninstalled wallets link to their extension', async ({ page }) => {
    await page.goto('/')
    await page.click('#wbtn')
    await expect(page.locator('#wmodal .wopt[data-wallet="injected"]')).toHaveCount(0)
    const okx = page.locator('#wmodal .wopt[data-wallet="okx"]')
    await expect(okx).toContainText('Get extension')
    await expect(okx).toHaveAttribute('href', /^https:\/\//)
    await expect(page.locator('#wapps')).toHaveCount(0) // desktop: no "open in app" section
  })

  test('a wallet announced via EIP-6963 appears under "Detected in your browser" with its icon and connects', async ({ page }) => {
    const icon = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><rect width="8" height="8" fill="#e33"/></svg>').toString('base64')
    await page.addInitScript(FAKE_PROVIDER.replace('isRabby: true', 'isRabby: false').replace('window.ethereum = provider;', `
      const info = { uuid: 'b9c2c6e2-1111-4111-8111-000000000001', name: 'Backpack', icon: '${icon}', rdns: 'app.backpack' };
      const announce = () => window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: Object.freeze({ info, provider }) }));
      window.addEventListener('eip6963:requestProvider', announce); announce();`))
    await page.goto('/app?s=1')
    await page.click('#wbtn')
    const bp = page.locator('#wdetected .wopt', { hasText: 'Backpack' })
    await expect(bp).toContainText('Installed')
    await expect(bp.locator('img')).toHaveAttribute('src', /^data:image\/svg/)
    await bp.click()
    await expect(page.locator('#toast')).toHaveText('Connected with Backpack')
    await expect(page.locator('#wbtn')).toHaveText('0x1111…1111')
  })
})
