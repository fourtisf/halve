'use client'
import { useEffect, useState } from 'react'
import { useSwitchChain } from 'wagmi'
import type { Series } from '@/contracts/types'
import type { PositionData, SeriesStats } from '@/lib/types'
import { EARN_TIERS, SPLIT_FEE } from '@/contracts/constants'
import { f, monthYear } from '@/lib/format'
import { earnApr } from '@/lib/mock'
import { useMockPositions } from '@/lib/mockStore'
import { useToast } from '@/lib/toast'
import { useWalletModal } from '@/lib/walletModal'
import { CHAIN_ID, explorerTx } from '@/lib/wagmi'
import { quoteRedeemPT, quoteRedeemYT } from '@/lib/redeem'
import { isMatured, isSettled } from '@/lib/stats'
import { useSplit } from '@/hooks/useSplit'
import { useMerge } from '@/hooks/useMerge'
import { useRedeem } from '@/hooks/useRedeem'
import { useBuy, type PayWith } from '@/hooks/useBuy'
import { Banner } from './Skeleton'

export type Mode = 'buy' | 'split' | 'merge' | 'earn' | 'redeem'

type Props = {
  series: Series
  stats: SeriesStats
  position: PositionData
  mode: Mode
  onMode: (m: Mode) => void
  /** ?side= from the URL: which half the Buy tab starts on. */
  initialSide?: 'pt' | 'yt'
}

const trim = (n: number) => n.toFixed(4).replace(/\.?0+$/, '')

/**
 * Buy / Split / Merge / Earn panel — behaviour mirrors the prototype's syncApp()/calc()/go(); Redeem appears after maturity.
 * Buy is the front door for newcomers: two plain-language choices, pay with ETH or the stock, one button.
 */
export function ActionPanel({ series, stats, position, mode, onMode, initialSide }: Props) {
  const t = series.ticker
  const [amt, setAmt] = useState(mode === 'buy' ? '0.1' : '1')
  const [side, setSide] = useState<'pt' | 'yt'>(initialSide ?? 'pt')
  const [payWith, setPayWithState] = useState<PayWith>('eth')
  const setPayWith = (p: PayWith) => { setPayWithState(p); setAmt(p === 'eth' ? '0.1' : '1') }
  useEffect(() => { if (initialSide) setSide(initialSide) }, [initialSide])
  const { toast } = useToast()
  const { open } = useWalletModal()
  const { switchChain } = useSwitchChain()
  const { update } = useMockPositions()
  const splitH = useSplit(series)
  const mergeH = useMerge(series)
  const redeemH = useRedeem(series, stats.accrued)
  const buyH = useBuy(series, stats, side, payWith, amt)

  const matured = isMatured(series, stats)
  const settled = isSettled(stats) || (matured && stats.isMock)
  useEffect(() => { if (mode === 'redeem' && !matured) onMode('buy') }, [mode, matured, onMode])

  const a = parseFloat(amt) || 0
  const n = a * (1 - SPLIT_FEE)
  const { ytPrice, usdPrice: px, fixedApy, divYield } = stats
  const apy = f(fixedApy * 100, 1)
  const apr = f(earnApr(divYield), 1)
  const wallet = position.connected
  const buyToken = `${side === 'pt' ? 'p' : 'y'}${t}`
  const maturityLabel = monthYear(series.maturity)
  const ptPct = stats.ready && stats.ptPrice > 0 ? `${f(stats.ptPrice * 100, 0)}%` : '—'
  const ytPct = stats.ready && ytPrice > 0 ? `${f(ytPrice * 100, 1)}%` : '—'
  const balance = mode === 'merge' ? Math.min(position.pt, position.yt) : mode === 'redeem' ? (side === 'pt' ? position.pt : position.yt) : mode === 'buy' && payWith === 'eth' ? buyH.ethBalance : position.stock
  const inAsset = mode === 'merge' ? `p${t} + y${t}` : mode === 'redeem' ? (side === 'pt' ? `p${t}` : `y${t}`) : mode === 'buy' && payWith === 'eth' ? 'ETH' : t
  const busy = splitH.busy || mergeH.busy || redeemH.busy || buyH.busy
  const status = mode === 'split' ? splitH.status : mode === 'merge' ? mergeH.status : mode === 'redeem' ? redeemH.status : mode === 'buy' ? buyH.status : 'idle'
  const txHash = mode === 'split' ? splitH.txHash : mode === 'merge' ? mergeH.txHash : mode === 'redeem' ? redeemH.txHash : mode === 'buy' ? buyH.txHash : null
  const redeemQuote = side === 'pt' ? quoteRedeemPT(a, stats.accrued) : quoteRedeemYT(a, stats.accrued)

  // Validation (only once a wallet is connected, so the disconnected state matches the prototype).
  const needsSettle = mode === 'redeem' && !settled
  const invalid = wallet && !position.wrongChain && !needsSettle ? (a <= 0 ? 'Enter an amount' : a > balance ? `Insufficient ${inAsset}` : null) : null
  const splitClosed = mode === 'split' && matured
  const noRoute = mode === 'buy' && buyH.noRoute

  const label = !wallet
    ? 'Connect wallet'
    : position.wrongChain
      ? 'Switch to Robinhood Chain'
      : status === 'approving'
        ? `Approve ${inAsset}…`
        : status === 'sending' || status === 'confirming'
          ? mode === 'split' ? 'Splitting…' : mode === 'merge' ? 'Merging…' : mode === 'buy' ? 'Buying…' : needsSettle ? 'Settling…' : 'Redeeming…'
          : splitClosed
            ? 'Series matured · split closed'
            : needsSettle
              ? 'Settle series'
              : noRoute
                ? `No ${inAsset} → ${buyToken} route yet`
                : mode === 'buy' && buyH.quoting
                  ? 'Fetching quote…'
                  : invalid ?? (mode === 'split'
                    ? `Split ${a || 0} ${t}`
                    : mode === 'merge'
                      ? `Merge into ${a || 0} ${t}`
                      : mode === 'redeem'
                        ? `Redeem ${a || 0} ${inAsset}`
                        : mode === 'buy'
                          ? `Buy ${buyToken}`
                          : `Provide ${a || 0} ${t}`)

  const disabled = busy || !!invalid || splitClosed || noRoute || (mode === 'buy' && (buyH.quoting || buyH.amountOut <= 0))

  const go = async () => {
    if (!wallet) return open()
    if (position.wrongChain) return switchChain({ chainId: CHAIN_ID })
    if (mode === 'split') return splitH.split(amt)
    if (mode === 'merge') return mergeH.merge(amt)
    if (mode === 'redeem') return needsSettle ? redeemH.settle() : redeemH.redeem(side, amt)
    if (mode === 'buy') return buyH.buy()
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
    mode === 'buy'
      ? `One transaction on Uniswap v3${payWith === 'eth' ? ` (ETH → ${t} → ${buyToken})` : ''}, up to 1% price movement allowed. Sell it back any time the same way, or merge p${t} + y${t} into ${t} for free.`
      : mode === 'split'
      ? `Keep both and nothing changes. Sell y${t} to lock ${apy}% fixed. Sell p${t} to own only the dividends.`
      : mode === 'merge'
        ? 'Free, always. Works before and after maturity and never depends on pool liquidity.'
        : mode === 'redeem'
          ? needsSettle
            ? 'Anyone can settle once the series matures. Redemption opens right after, and merge stays open throughout.'
            : `p${t} redeems one full share each. y${t} redeems the dividends reinvested since the series started, less the 5% yield redemption fee.`
          : `Halve pares exactly what the pools need and mints both Uniswap v3 positions in one transaction. Earn swap fees plus $HALVE incentives (${apr}% APR).`

  return (
    <div className="panel">
      <div className="seg">
        <button className={mode === 'buy' ? 'on' : undefined} id="tBuy" onClick={() => onMode('buy')}>Buy</button>
        <button className={mode === 'split' ? 'on' : undefined} id="tSplit" onClick={() => onMode('split')}>Split</button>
        <button className={mode === 'merge' ? 'on' : undefined} id="tMerge" onClick={() => onMode('merge')}>Merge</button>
        <button className={mode === 'earn' ? 'on' : undefined} id="tEarn" onClick={() => onMode('earn')}>Earn</button>
        {matured && <button className={mode === 'redeem' ? 'on' : undefined} id="tRedeem" onClick={() => onMode('redeem')}>Redeem</button>}
      </div>
      {matured && mode !== 'redeem' && <Banner kind="y">Series matured · {settled ? 'redemption open' : 'awaiting settle()'}</Banner>}
      {mode === 'buy' && (<>
        <div className="step">1 · What do you want?</div>
        <div className="pick" id="buySide">
          <button className={`pt${side === 'pt' ? ' on' : ''}`} onClick={() => setSide('pt')} aria-pressed={side === 'pt'}>
            <small>Fixed return</small>
            <b>{apy}%<em>fixed</em></b>
            <span>Buy p{t} for {ptPct} of a share today. In {maturityLabel} it becomes 1 full {t}.</span>
          </button>
          <button className={`yt${side === 'yt' ? ' on' : ''}`} onClick={() => setSide('yt')} aria-pressed={side === 'yt'}>
            <small>Dividends only</small>
            <b>{ytPct}<em>of a share</em></b>
            <span>Buy y{t} and collect every dividend {t} pays until {maturityLabel}.</span>
          </button>
        </div>
        <div className="step">2 · Pay with</div>
        <div className="side-sel" id="payWith">
          <button className={payWith === 'eth' ? 'on' : undefined} onClick={() => setPayWith('eth')}>ETH</button>
          <button className={payWith === 'stock' ? 'on' : undefined} onClick={() => setPayWith('stock')}>{t}</button>
        </div>
        <div className="step">3 · How much</div>
      </>)}
      {mode === 'redeem' && (
        <div className="side-sel" id="redeemSide">
          <button className={side === 'pt' ? 'on' : undefined} onClick={() => setSide('pt')}>p{t}</button>
          <button className={side === 'yt' ? 'on' : undefined} onClick={() => setSide('yt')}>y{t}</button>
        </div>
      )}
      <div className="fld">
        <label>
          <span id="inLbl">{mode === 'split' ? 'You deposit' : mode === 'merge' ? 'You merge' : mode === 'redeem' ? 'You redeem' : mode === 'buy' ? 'You pay' : 'You provide'}</span>
          <span>Balance <span className="mono" id="bal">{f(wallet ? balance : 0, 2)}</span> <button type="button" onClick={() => setAmt(wallet ? trim(balance) : '0')}>Max</button></span>
        </label>
        <div className="in">
          <input id="amt" value={amt} inputMode="decimal" aria-label="Amount" aria-invalid={!!invalid} onChange={(e) => setAmt(e.target.value)} />
          <div className="asset"><i /><span id="inAsset">{inAsset}</span></div>
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
        {mode === 'redeem' && (
          <div className="fld" style={{ gridColumn: '1/-1' }}><label>You receive</label><div className="v" id="o1">{f(redeemQuote.out, 4)} {t}</div></div>
        )}
        {mode === 'buy' && (
          <div className={`fld ${side === 'pt' ? 'p' : 'y'}`} style={{ gridColumn: '1/-1' }}><label>You get{buyH.quoting ? ' · quoting' : ''}</label><div className="v" id="o1">{buyH.amountOut > 0 ? `${f(buyH.amountOut, 4)} ${buyToken}` : `— ${buyToken}`}</div></div>
        )}
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
        {mode === 'buy' && (<>
          {side === 'pt'
            ? <div><span>Worth in {maturityLabel}</span><b className="g" id="buyLater">{f(buyH.amountOut, 4)} {t}</b></div>
            : <div><span>Collects</span><b className="y" id="buyLater">every {t} dividend until {maturityLabel}</b></div>}
          <div><span>Value now</span><b>${f(buyH.amountOut * (side === 'pt' ? stats.ptPrice : ytPrice) * px, 2)}</b></div>
          <div><span>At least (1% slippage)</span><b>{f(buyH.minOut, 4)} {buyToken}</b></div>
          <div><span>Route</span><b id="route">{buyH.routeLabel ?? '—'}</b></div>
        </>)}
        {mode === 'redeem' && (<>
          <div><span>Fee</span><b>{side === 'pt' ? '0 · free' : `${f(redeemQuote.fee, 4)} ${t} (5%)`}</b></div>
          <div><span>Value</span><b>${f(redeemQuote.out * px, 2)}</b></div>
          {side === 'yt' && <div><span>Accrued since d0</span><b className="y">{f(stats.accrued * 100, 2)}%</b></div>}
        </>)}
      </div>
      <button className="btn btn-white" style={{ width: '100%', height: 42 }} id="go" disabled={disabled} onClick={go}>{label}</button>
      {txHash && <a className="txlink" id="txlink" href={explorerTx(txHash)} target="_blank" rel="noopener noreferrer">View on Blockscout ↗</a>}
      <div className="note" id="sideNote">{sideNote}</div>
      {mode === 'buy' && (
        <details className="howto" id="howto">
          <summary>New to this? Three steps</summary>
          <ol>
            <li><b>Get a wallet.</b> MetaMask or Rabby, as a browser extension or a phone app. Then press Connect wallet above.</li>
            <li><b>Put some ETH in it on Robinhood Chain.</b> ETH is what you pay with, and it covers the small network fee. Move ETH over with the <a href="https://docs.robinhood.com/chain/bridging/" target="_blank" rel="noopener noreferrer">Robinhood Chain bridge</a>. Halve asks your wallet to switch to the right network.</li>
            <li><b>Pick, type an amount, press Buy.</b> Your p{t} or y{t} shows under Position right away. Sell it back the same way whenever you like.</li>
          </ol>
        </details>
      )}
    </div>
  )
}
