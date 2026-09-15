/**
 * "Open in wallet app" deep links for phones without an injected provider. Each one launches the
 * current page inside the wallet's own in-app browser, where the wallet injects window.ethereum and
 * the normal injected connection works. No WalletConnect project or relay involved.
 */
export type WalletAppLink = { id: string; label: string; href: (url: string) => string }

export const WALLET_APP_LINKS: WalletAppLink[] = [
  { id: 'metamask', label: 'MetaMask', href: (u) => `https://metamask.app.link/dapp/${u.replace(/^https?:\/\//, '')}` },
  { id: 'trust', label: 'Trust Wallet', href: (u) => `https://link.trustwallet.com/open_url?coin_id=60&url=${encodeURIComponent(u)}` },
  { id: 'coinbase', label: 'Coinbase Wallet', href: (u) => `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(u)}` },
  { id: 'okx', label: 'OKX Wallet', href: (u) => `okx://wallet/dapp/url?dappUrl=${encodeURIComponent(u)}` },
  { id: 'phantom', label: 'Phantom', href: (u) => `https://phantom.app/ul/browse/${encodeURIComponent(u)}?ref=${encodeURIComponent(new URL(u).origin)}` },
]

/** EIP-6963 reverse-DNS ids of wallets that already have a dedicated RainbowKit entry (to avoid duplicates). */
export const RDNS_TO_WALLET: Record<string, string> = {
  'io.metamask': 'metaMask',
  'io.rabby': 'rabby',
  'com.coinbase.wallet': 'coinbase',
  'com.trustwallet.app': 'trust',
  'com.okex.wallet': 'okx',
  'app.phantom': 'phantom',
  'me.rainbow': 'rainbow',
  'com.binance.wallet': 'binance',
}

export const isCoarsePointer = () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches
