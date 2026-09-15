import type { ReactNode } from 'react'

/** Long-form page layout for legal and documentation pages. */
export function Prose({ kicker, title, updated, children, wide }: { kicker: string; title: string; updated: string | null; children: ReactNode; wide?: boolean }) {
  return (
    <section><div className="wrap">
      <div className="sec-h" style={{ marginBottom: 32 }}><div className="k">{kicker}</div><h2>{title}</h2>{updated && <p className="mono" style={{ fontSize: 12.5, color: 'var(--fg3)' }}>Last updated {updated}</p>}</div>
      <article className={'prose' + (wide ? ' wide' : '')}>{children}</article>
    </div></section>
  )
}
