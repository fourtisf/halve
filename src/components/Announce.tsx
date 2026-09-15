'use client'
import { useEffect, useState } from 'react'
import { LINKS, X_HANDLE } from '@/lib/links'
import { XIcon } from './XIcon'

const KEY = 'halve:announce:x:v1'

/** Slim bar above the nav pointing at the X account, where series launches and contract addresses land first. Dismissible. */
export function Announce() {
  const [hidden, setHidden] = useState(false)
  useEffect(() => {
    try { if (localStorage.getItem(KEY) === '1') setHidden(true) } catch { /* storage unavailable */ }
  }, [])
  if (hidden) return null
  const dismiss = () => {
    setHidden(true)
    try { localStorage.setItem(KEY, '1') } catch { /* storage unavailable */ }
  }
  return (
    <div className="announce" id="announce" role="region" aria-label="Announcement">
      <div className="wrap">
        <a href={LINKS.x} target="_blank" rel="noopener noreferrer" id="announceLink">
          <i aria-hidden="true" />
          <span>Series launches, contract addresses and the $HALVE CA are announced on X first.</span>
          <b><XIcon size={12} />Follow {X_HANDLE}</b>
        </a>
        <button type="button" onClick={dismiss} aria-label="Dismiss announcement" id="announceClose">×</button>
      </div>
    </div>
  )
}
