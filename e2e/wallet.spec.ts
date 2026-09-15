import { expect, test } from '@playwright/test'

const ACCOUNT = '0x1111111111111111111111111111111111111111'

/** Minimal EIP-1193 provider injected before the app loads, flagged as Rabby so the Rabby option treats it as installed. */
const FAKE_PROVIDER = `
(() => {
  const listeners = {};
  let chainId = '0x1';
  const provider = {
    isMetaMask: false,
    isRabby: true,
    request: async ({ method, params }) => {
      switch (method) {
        case 'eth_requestAccounts':
        case 'eth_accounts': return ['${ACCOUNT}'];
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
    await page.goto('/app?s=1')
    await page.click('#wbtn')
    const rabby = page.locator('#wmodal .wopt[data-wallet="rabby"]')
    await expect(rabby).toContainText('Installed')
    await rabby.click()
    await expect(page.locator('#toast')).toHaveText('Connected with Rabby')
    await expect(page.locator('#wbtn')).toHaveText('0x1111…1111')
    await expect(page.locator('#wmodal')).not.toHaveClass(/open/)
    // ChainGuard switched the fake wallet from mainnet to Robinhood Chain, so the action button is live.
    await expect(page.locator('#go')).toHaveText('Split 1 JEPI')
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

  test('without any extension the browser-wallet option is hidden and other wallets say Get', async ({ page }) => {
    await page.goto('/')
    await page.click('#wbtn')
    await expect(page.locator('#wmodal .wopt[data-wallet="injected"]')).toHaveCount(0)
    await expect(page.locator('#wmodal .wopt[data-wallet="okx"]')).toContainText('Get')
  })
})
