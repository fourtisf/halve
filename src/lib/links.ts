/** External links. Empty env values fall back to '#' so nothing 404s before the docs exist. */
const env = (v: string | undefined) => (v && v.length > 0 ? v : '#')

export const LINKS = {
  docs: env(process.env.NEXT_PUBLIC_DOCS_URL),
  contracts: env(process.env.NEXT_PUBLIC_CONTRACTS_URL || 'https://robinhoodchain.blockscout.com'),
  audit: env(process.env.NEXT_PUBLIC_AUDIT_URL),
  api: env(process.env.NEXT_PUBLIC_API_URL),
  x: env(process.env.NEXT_PUBLIC_X_URL),
  telegram: env(process.env.NEXT_PUBLIC_TELEGRAM_URL),
  discord: env(process.env.NEXT_PUBLIC_DISCORD_URL),
} as const

export const externalProps = (href: string) => (href === '#' ? {} : { target: '_blank', rel: 'noopener noreferrer' })
