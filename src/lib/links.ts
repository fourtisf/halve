/** Site links. Internal paths are the default; an env value replaces one with an external URL. Empty falls back to '#'. */
export const X_HANDLE = '@Halvefinance'
const env = (v: string | undefined, fallback = '#') => (v && v.length > 0 ? v : fallback)

export const LINKS = {
  docs: env(process.env.NEXT_PUBLIC_DOCS_URL, '/docs'),
  contracts: env(process.env.NEXT_PUBLIC_CONTRACTS_URL, '/docs#contracts'),
  audit: env(process.env.NEXT_PUBLIC_AUDIT_URL, '/docs#security'),
  api: env(process.env.NEXT_PUBLIC_API_URL, '/docs#api'),
  x: env(process.env.NEXT_PUBLIC_X_URL, 'https://x.com/Halvefinance'),
  telegram: env(process.env.NEXT_PUBLIC_TELEGRAM_URL),
  discord: env(process.env.NEXT_PUBLIC_DISCORD_URL),
} as const

export const isExternal = (href: string) => /^https?:\/\//.test(href)
export const externalProps = (href: string) => (isExternal(href) ? { target: '_blank', rel: 'noopener noreferrer' } : {})
