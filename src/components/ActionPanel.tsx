'use client'
import { useState } from 'react'
import { useSwitchChain } from 'wagmi'
import type { Series } from '@/contracts/types'
import type { PositionData, SeriesStats } from '@/lib/types'
import { EARN_TIERS, SPLIT_FEE } from '@/contracts/constants'
import { f } from '@/lib/format'
import { earnApr } from '@/lib/mock'
import { useMockPositions } from '@/lib/mockStore'
import { useToast } from '@/lib/toast'
import { useWalletModal } from '@/lib/walletModal'
import { CHAIN_ID } from '@/lib/wagmi'
import { useSplit } from '@/hooks/useSplit'
import { useMerge } from '@/hooks/useMerge'

export type Mode = 'split' | 'merge' | 'earn'

type Props = {
  series: Series
  stats: SeriesStats
  position: PositionData
  mode: Mode
  onMode: (m: Mode) => void
}

/** Split / Merge / Earn panel — behaviour mirrors the prototype's syncApp()/calc()/go(). */
export function ActionPanel({ series, stats, position, mode, onMode }: Props) {
  const t = series.ticker
  const [amt, setAmt] = useState('1')
  const { toast } = useToast()
  const { open } = useWalletModal()
  const { switchChain } = useSwitchChain()
  const { update } = useMockPositions()
  const { split, status: splitStatus, busy: splitBusy } = useSplit(series)
  const { merge, status: mergeStatus, busy: mergeBusy } = useMerge(series)

  const a = parseFloat(amt) || 0
  const n = a * (1 - SPLIT_FEE)
  const { ytPrice, usdPrice: px, fixedApy, divYield } = stats
  const apy = f(fixedApy * 100, 1)
  const apr = f(earnApr(divYield), 1)
  const balance = mode === 'merge' ? Math.min(position.pt, position.yt) : position.stock
  const wallet = position.connected
  const busy = splitBusy || mergeBusy
  const status = mode === 'split' ? splitStatus : mode === 'merge' ? mergeStatus : 'idle'

  const label = !wallet
    ? 'Connect wallet'
    : position.wrongChain
      ? 'Switch to Robinhood Chain'
      : status === 'approving'
        ? `Approve ${mode === 'merge' ? `p${t} + y${t}` : t}…`
        : status === 'sending' || status === 'confirming'
          ? mode === 'split' ? 'Splitting…' : 'Merging…'
          : mode === 'split'
            ? `Split ${a || 0} ${t}`
            : mode === 'merge'
              ? `Merge into ${a || 0} ${t}`
              : `Provide ${a || 0} ${t}`

  const go = async () => {
    if (!wallet) return open()
    if (position.wrongChain) return switchChain({ chainId: CHAIN_ID })
    if (mode === 'split') return split(amt)
    if (mode === 'merge') return merge(amt)
    // Earn — phase 1 is quote only; the router is phase 2.
    if (position.isMock) {
      if (a <= 0) return
      update(t, (p) => ({ ...p, lp: p.lp + n }))
      toast(`Provided ${a} ${t} to both pools`)
    } else {
      toast('Earn router is phase 2 · quote only')
    }
  }

  const sideNote =
    mode === 'split'
      ? `Keep both and nothing changes. Sell y${t} to lock ${apy}% fixed. Sell p${t} to own only the dividends.`
      : mode === 'merge'
        ? 'Free, always. Works before and after maturity and never depends on pool liquidity.'
        : `Halve pares exactly what the pools need and mints both Uniswap v3 positions in one transaction. Earn swap fees plus $HALVE incentives (${apr}% APR).`

  return (
    <div className="panel">
      <div className="seg">
        <button className={mode === 'split' ? 'on' : undefined} id="tSplit" onClick={() => onMode('split')}>Split</button>
        <button className={mode === 'merge' ? 'on' : undefined} id="tMerge" onClick={() => onMode('merge')}>Merge</button>
        <button className={mode === 'earn' ? 'on' : undefined} id="tEarn" onClick={() => onMode('earn')}>Earn</button>
      </div>
      <div className="fld">
        <label>
          <span id="inLbl">{mode === 'split' ? 'You deposit' : mode === 'merge' ? 'You merge' : 'You provide'}</span>
          <span>Balance <span className="mono" id="bal">{f(wallet ? balance : 0, 2)}</span> <button type="button" onClick={() => setAmt(wallet ? String(balance) : '0')}>Max</button></span>
        </label>
        <div className="in">
          <input id="amt" value={amt} inputMode="decimal" aria-label="Amount" onChange={(e) => setAmt(e.target.value)} />
          <div className="asset"><i /><span id="inAsset">{mode === 'merge' ? `p${t} + y${t}` : t}</span></div>
        </div>
      </div>
      <div className="arrow">↓</div>
      <div className="outs" id="outs">
        {mode === 'split' && (<>
          <div className="fld p"><label>You receive</label><div className="v" id="o1">{f(n, 3)} p{t}</div></div>
          <div className="fld y"><label>You receive</label><div className="v" id="o2">{f(n, 3)} y{t}</div></div>
        </>)}
        {mode === 'merge' && (
          <div className="fld" style={{ gridColumn: '1/-1' }}><label>You receive</label><div className="v" id="o1">{f(a, 3)} {t}</div></div>
        )}
        {mode === 'earn' && (<>
          <div className="fld p"><label>LP · p{t}/{t}</label><div className="v" id="o1">{f(n * 0.5, 3)} LP</div></div>
          <div className="fld y"><label>LP · y{t}/{t}</label><div className="v" id="o2">{f(n * 0.5, 3)} LP</div></div>
        </>)}
      </div>
      <div className="meta" id="meta">
        {mode === 'split' && (<>
          <div><span>Fee</span><b>{f(a * SPLIT_FEE, 4)} {t} (0.10%)</b></div>
          <div><span>p{t} value now</span><b>${f(n * (1 - ytPrice) * px, 2)}</b></div>
          <div><span>y{t} value now</span><b>${f(n * ytPrice * px, 2)}</b></div>
          <div><span>Fixed APY if you sell YT</span><b className="g">{apy}%</b></div>
        </>)}
        {mode === 'merge' && (<>
          <div><span>Fee</span><b>0 · free</b></div>
          <div><span>Value</span><b>${f(a * px, 2)}</b></div>
        </>)}
        {mode === 'earn' && (<>
          <div><span>Pared</span><b>{f(n * 0.5, 3)} {t}</b></div>
          <div><span>Ranges</span><b>{EARN_TIERS.pt} tier · {EARN_TIERS.yt} tier</b></div>
          <div><span>Est. APR</span><b className="g">{apr}%</b></div>
        </>)}
      </div>
      <button className="btn btn-white" style={{ width: '100%', height: 42 }} id="go" disabled={busy} onClick={go}>{label}</button>
      <div className="note" id="sideNote">{sideNote}</div>
    </div>
  )
}
