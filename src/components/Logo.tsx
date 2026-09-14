/**
 * Halve mark ("Stack"): two paper bars for the share, one gold bar lifted off the top for the dividend.
 * 64-unit grid; never rotated, never gradiented. Inline SVG so it scales and recolors anywhere.
 */
export function HalveMark({ size = 20, ink = '#FAFAFA', gold = '#E8C170', title }: { size?: number; ink?: string; gold?: string; title?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" role={title ? 'img' : undefined} aria-hidden={title ? undefined : true} style={{ display: 'block', flexShrink: 0 }}>
      {title ? <title>{title}</title> : null}
      <rect x="8" y="44" width="48" height="10" rx="3" fill={ink} />
      <rect x="8" y="30" width="48" height="10" rx="3" fill={ink} />
      <rect x="14" y="10" width="48" height="10" rx="3" fill={gold} />
    </svg>
  )
}

/** Mark + wordmark lockup, as used in the nav and footer. */
export function HalveLogo({ size = 20 }: { size?: number }) {
  return (
    <>
      <HalveMark size={size} />
      Halve
    </>
  )
}
