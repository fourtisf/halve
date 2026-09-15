import Link from 'next/link'
import type { ReactNode } from 'react'

export type AppTab = 'buy' | 'split' | 'earn' | 'portfolio' | 'lend' | 'oracle'

const TABS: { key: AppTab; href: string; label: string }[] = [
  { key: 'buy', href: '/app?tab=buy', label: 'Buy' },
  { key: 'split', href: '/app?tab=split', label: 'Split' },
  { key: 'earn', href: '/app?tab=earn', label: 'Earn' },
  { key: 'portfolio', href: '/app?tab=portfolio', label: 'Portfolio' },
  { key: 'lend', href: '/lend', label: 'Lend' },
  { key: 'oracle', href: '/oracle', label: 'Oracle' },
]

/** App bar shared by /app, /lend and /oracle. */
export function AppShell({ active, children }: { active: AppTab; children: ReactNode }) {
  return (
    <div>
      <div className="appbar"><div className="wrap">
        {TABS.map((t) => <Link key={t.key} href={t.href} className={t.key === active ? 'on' : undefined}>{t.label}</Link>)}
      </div></div>
      {children}
    </div>
  )
}
