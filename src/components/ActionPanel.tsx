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
import { useLimitOrders } from '@/hooks/useLimitOrders'
import { Banner } from './Skeleton'
import { Orders } from './Orders'

export type Mode = 'buy' | 'split' | 'merge' | 'earn' | 'redeem'
type Dir = 'buy' | 'sell'
type OrderType = 'market' | 'limit'

type Props = {
  series: Series
  stats: SeriesStats
  position: PositionData
  mode: Mode
  onMode: (m: Mode) => void
  /** ?side= from the URL: which half the Trade tab starts on. */
  initialSide?: 'pt' | 'yt'
}

const trim = (n: number) => n.toFixed(4).replace(/\.?0+$/, '')

/**
 * Trade / Split / Merge / Earn panel — behaviour mirrors the prototype's syncApp()/calc()/go(); Redeem appears after maturity.
 * Trade is the front door for newcomers: buy or sell, two plain-language choices, pay with ETH or the stock,
 * now at the market price or later at a price you set (a Uniswap v3 range order), one button.
 */
export function ActionPanel({ series, stats, position, mode, onMode, initialSide }: Props) {
  const t = series.ticker
  const [amt, setAmt] = useState(mode === 'buy' ? '0.1' : '1')
  const [side, setSide] = useState<'pt' | 'yt'>(initialSide ?? 'pt')
  const [dir, setDirState] = useState<Dir>('buy')
  const [orderType, setOrderType] = useState<OrderType>('market')
  const [limitPrice, setLimitPrice] = useState('')
  const [payWith, setPayWithState] = useState<PayWith>('eth')
  const setPayWith = (p: PayWith) => { setPayWithState(p); if (dir === 'buy') setAmt(p === 'eth' ? '0.1' : '1') }
  const setDir = (d: Dir) => { setDirState(d); setAmt(d === 'sell' ? '1' : payWith === 'eth' ? '0.1' : '1') }
  useEffect(() => { if (initialSide) setSide(initialSide) }, [initialSide])
  // a limit sell settles in the stock: the position holds the token and the pool converts it to stock
  useEffect(() => { if (orderType === 'limit' && dir === 'sell' && payWith === 'eth') setPayWithState('stock') }, [orderType, dir, payWith])
  const { toast } = useToast()
  const { open } = useWalletModal()
  const { switchChain } = useSwitchChain()
  const { update } = useMockPositions()
  const splitH = useSplit(series)
  const mergeH = useMerge(series)
  const redeemH = useRedeem(series, stats.accrued)
  const buyH = useBuy(series, stats, side, payWith, amt, dir)
  const limitH = useLimitOrders(series, stats, { side, direction: dir, payWith, amount: amt, price: limitPrice, active: mode === 'buy', limit: mode === 'buy' && orderType === 'limit' })

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
  const trade = mode === 'buy'
  const limit = trade && orderType === 'limit'
  const selling = trade && dir === 'sell'
  const counter = payWith === 'eth' ? 'ETH' : t
  const tokenHeld = side === 'pt' ? position.pt : position.yt
  const balance = mode === 'merge' ? Math.min(position.pt, position.yt) : mode === 'redeem' ? tokenHeld : selling ? tokenHeld : trade && payWith === 'eth' ? buyH.ethBalance : position.stock
  const inAsset = mode === 'merge' ? `p${t} + y${t}` : mode === 'redeem' || selling ? buyToken : trade ? counter : t
  const activeH = limit ? limitH : buyH
  const busy = splitH.busy || mergeH.busy || redeemH.busy || buyH.busy || limitH.busy
  const status = mode === 'split' ? splitH.status : mode === 'merge' ? mergeH.status : mode === 'redeem' ? redeemH.status : trade ? activeH.status : 'idle'
  const txHash = mode === 'split' ? splitH.txHash : mode === 'merge' ? mergeH.txHash : mode === 'redeem' ? redeemH.txHash : trade ? activeH.txHash : null
  const redeemQuote = side === 'pt' ? quoteRedeemPT(a, stats.accrued) : quoteRedeemYT(a, stats.accrued)
  const range = limit ? limitH.range : null
  const out = limit ? limitH.expected : buyH.amountOut
  const outAsset = selling ? counter : buyToken

  // Validation (only once a wallet is connected, so the disconnected state matches the prototype).
  const needsSettle = mode === 'redeem' && !settled
  const invalid = wallet && !position.wrongChain && !needsSettle ? (a <= 0 ? 'Enter an amount' : a > balance ? `Insufficient ${inAsset}` : null) : null
  const splitClosed = mode === 'split' && matured
  const noRoute = trade && (limit ? limitH.ethNoRoute : buyH.noRoute)
  const quoting = trade && (limit ? limitH.ethQuoting : buyH.quoting)
  const badLimit = limit && (!range || !range.ok)

  const label = !wallet
    ? 'Connect wallet'
    : position.wrongChain
      ? 'Switch to Robinhood Chain'
      : status === 'approving'
        ? `Approve ${inAsset}…`
        : status === 'sending' || status === 'confirming'
          ? mode === 'split' ? 'Splitting…' : mode === 'merge' ? 'Merging…' : trade ? (limit ? 'Placing order…' : selling ? 'Selling…' : 'Buying…') : needsSettle ? 'Settling…' : 'Redeeming…'
          : splitClosed
            ? 'Series matured · split closed'
            : needsSettle
              ? 'Settle series'
              : noRoute
                ? `No ${selling ? `${buyToken} → ${counter}` : `${counter} → ${buyToken}`} route yet`
                : quoting
                  ? 'Fetching quote…'
                  : invalid ?? (mode === 'split'
                    ? `Split ${a || 0} ${t}`
                    : mode === 'merge'
                      ? `Merge into ${a || 0} ${t}`
                      : mode === 'redeem'
                        ? `Redeem ${a || 0} ${inAsset}`
                        : trade
                          ? limit ? (range?.ok ? `Place limit ${dir}` : !range || range.reason === 'Enter a price' ? 'Enter a price' : 'Adjust the price') : `${selling ? 'Sell' : 'Buy'} ${buyToken}`
                          : `Provide ${a || 0} ${t}`)

  const disabled = busy || !!invalid || splitClosed || noRoute || (trade && (quoting || badLimit || out <= 0))

  const go = async () => {
    if (!wallet) return open()
    if (position.wrongChain) return switchChain({ chainId: CHAIN_ID })
    if (mode === 'split') return splitH.split(amt)
    if (mode === 'merge') return mergeH.merge(amt)
    if (mode === 'redeem') return needsSettle ? redeemH.settle() : redeemH.redeem(side, amt)
    if (trade) return limit ? limitH.place() : buyH.buy()
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
    trade
      ? limit
        ? `Placed as a one-tick Uniswap v3 position: it fills when the pool price crosses your limit, at your limit or better, and earns the pool fee instead of paying it. Claim it once it fills; cancel any time and the deposit comes straight back.${dir === 'buy' && payWith === 'eth' ? ` Your ETH is swapped to ${t} now; the order waits in ${t}.` : ''}`
        : selling
          ? `One transaction on Uniswap v3${payWith === 'eth' ? ` (${buyToken} → ${t} → ETH)` : ''}, up to 1% price movement allowed. Or merge p${t} + y${t} into ${t} for free if you hold both.`
          : `One transaction on Uniswap v3${payWith === 'eth' ? ` (ETH → ${t} → ${buyToken})` : ''}, up to 1% price movement allowed. Sell it back any time the same way, or merge p${t} + y${t} into ${t} for free.`
      : mode === 'split'
      ? `Keep both and nothing changes. Sell y${t} to lock ${apy}% fixed. Sell p${t} to own only the dividends.`
      : mode === 'merge'
        ? 'Free, always. Works before and after maturity and never depends on pool liquidity.'
        : mode === 'redeem'
          ? needsSettle
            ? 'Anyone can settle once the series matures. Redemption opens right after, and merge stays open throughout.'
            : `p${t} redeems one full share each. y${t} redeems the dividends reinvested since the series started, less the 5% yield redemption fee.`
          : `Halve pares exactly what the pools need and mints both Uniswap v3 positions in one transaction. Earn swap fees plus $HALVE incentives (${apr}% APR).`

  const limitHint = !limit ? null : limitPrice === '' || !range
    ? limitH.pool ? `Now ${f(limitH.pool.current, 4)} ${t} per ${buyToken}. ${dir === 'buy' ? 'Type a lower price to buy cheaper.' : 'Type a higher price to sell dearer.'}` : 'Pool price loading…'
    : range.ok
      ? `Now ${f(range.current, 4)} · fills between ${f(range.priceLow, 4)} and ${f(range.priceHigh, 4)} ${t} per ${buyToken}`
      : range.reason

  return (<>
    <div className="panel">
      <div className="seg">
        <button className={mode === 'buy' ? 'on' : undefined} id="tBuy" onClick={() => onMode('buy')}>Trade</button>
        <button className={mode === 'split' ? 'on' : undefined} id="tSplit" onClick={() => onMode('split')}>Split</button>
        <button className={mode === 'merge' ? 'on' : undefined} id="tMerge" onClick={() => onMode('merge')}>Merge</button>
        <button className={mode === 'earn' ? 'on' : undefined} id="tEarn" onClick={() => onMode('earn')}>Earn</button>
        {matured && <button className={mode === 'redeem' ? 'on' : undefined} id="tRedeem" onClick={() => onMode('redeem')}>Redeem</button>}
      </div>
      {matured && mode !== 'redeem' && <Banner kind="y">Series matured · {settled ? 'redemption open' : 'awaiting settle()'}</Banner>}
      {trade && (<>
        <div className="side-sel dir" id="dir">
          <button className={dir === 'buy' ? 'on' : undefined} onClick={() => setDir('buy')} aria-pressed={dir === 'buy'}>Buy</button>
          <button className={`sell${dir === 'sell' ? ' on' : ''}`} onClick={() => setDir('sell')} aria-pressed={dir === 'sell'}>Sell</button>
        </div>
        <div className="step">1 · {selling ? 'What do you sell?' : 'What do you want?'}</div>
        <div className="pick" id="buySide">
          <button className={`pt${side === 'pt' ? ' on' : ''}`} onClick={() => setSide('pt')} aria-pressed={side === 'pt'}>
            <small>{selling ? `p${t}` : 'Fixed return'}</small>
            {selling
              ? <b>{f(position.pt, 3)}<em>you hold</em></b>
              : <b>{apy}%<em>fixed</em></b>}
            <span>{selling ? `The share claim. Kept to ${maturityLabel}, each one becomes 1 full ${t}.` : `Buy p${t} for ${ptPct} of a share today. In ${maturityLabel} it becomes 1 full ${t}.`}</span>
          </button>
          <button className={`yt${side === 'yt' ? ' on' : ''}`} onClick={() => setSide('yt')} aria-pressed={side === 'yt'}>
            <small>{selling ? `y${t}` : 'Dividends only'}</small>
            {selling
              ? <b>{f(position.yt, 3)}<em>you hold</em></b>
              : <b>{ytPct}<em>of a share</em></b>}
            <span>{selling ? `The dividend claim. Kept to ${maturityLabel}, it collects every ${t} payout.` : `Buy y${t} and collect every dividend ${t} pays until ${maturityLabel}.`}</span>
          </button>
        </div>
        <div className="step">2 · {selling ? 'Receive' : 'Pay with'}</div>
        <div className="side-sel" id="payWith">
          <button className={payWith === 'eth' ? 'on' : undefined} onClick={() => setPayWith('eth')} disabled={limit && selling} title={limit && selling ? `Limit sells settle in ${t}` : undefined}>ETH</button>
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
          <span id="inLbl">{mode === 'split' ? 'You deposit' : mode === 'merge' ? 'You merge' : mode === 'redeem' ? 'You redeem' : selling ? 'You sell' : trade ? 'You pay' : 'You provide'}</span>
          <span>Balance <span className="mono" id="bal">{f(wallet ? balance : 0, 2)}</span> <button type="button" onClick={() => setAmt(wallet ? trim(balance) : '0')}>Max</button></span>
        </label>
        <div className="in">
          <input id="amt" value={amt} inputMode="decimal" aria-label="Amount" aria-invalid={!!invalid} onChange={(e) => setAmt(e.target.value)} />
          <div className="asset"><i /><span id="inAsset">{inAsset}</span></div>
        </div>
      </div>
      {trade && (<>
        <div className="step">4 · Price</div>
        <div className="side-sel" id="orderType">
          <button className={orderType === 'market' ? 'on' : undefined} onClick={() => setOrderType('market')}>Market · now</button>
          <button className={orderType === 'limit' ? 'on' : undefined} onClick={() => setOrderType('limit')}>Limit · set a price</button>
        </div>
        {limit && (<>
          <div className="fld">
            <label><span>{dir === 'buy' ? 'Buy at or below' : 'Sell at or above'}</span><span>{t} per {buyToken}</span></label>
            <div className="in">
              <input id="limitPrice" value={limitPrice} inputMode="decimal" aria-label="Limit price" placeholder={limitH.pool ? f(limitH.pool.current, 4) : '0.0000'} aria-invalid={badLimit && limitPrice !== ''} onChange={(e) => setLimitPrice(e.target.value)} />
            </div>
          </div>
          <div className={`hint${range && !range.ok ? ' r' : ''}`} id="limitHint">{limitHint}</div>
        </>)}
      </>)}
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
        {trade && (
          <div className={`fld ${selling ? '' : side === 'pt' ? 'p' : 'y'}`} style={{ gridColumn: '1/-1' }}><label>{limit ? 'You get when it fills' : 'You get'}{quoting ? ' · quoting' : ''}</label><div className="v" id="o1">{out > 0 ? `${f(out, 4)} ${outAsset}` : `— ${outAsset}`}</div></div>
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
        {trade && !limit && (<>
          {!selling && (side === 'pt'
            ? <div><span>Worth in {maturityLabel}</span><b className="g" id="buyLater">{f(out, 4)} {t}</b></div>
            : <div><span>Collects</span><b className="y" id="buyLater">every {t} dividend until {maturityLabel}</b></div>)}
          <div><span>Value now</span><b>${f(selling ? (payWith === 'eth' ? out * buyH.ethUsd : out * px) : out * (side === 'pt' ? stats.ptPrice : ytPrice) * px, 2)}</b></div>
          <div><span>At least (1% slippage)</span><b>{f(buyH.minOut, 4)} {outAsset}</b></div>
          <div><span>Route</span><b id="route">{buyH.routeLabel ?? '—'}</b></div>
        </>)}
        {trade && limit && (<>
          <div><span>{dir === 'buy' ? 'Waits in the pool as' : 'Sells'}</span><b>{f(limitH.depositAmount, 4)} {dir === 'buy' ? t : buyToken}</b></div>
          <div><span>Fill window</span><b>{range?.ok ? `${f(range.priceLow, 4)} – ${f(range.priceHigh, 4)} ${t}` : '—'}</b></div>
          <div><span>Pool fee</span><b className="g">earned, not paid</b></div>
          <div><span>Value now</span><b>${f(limitH.depositAmount * (dir === 'buy' ? px : (side === 'pt' ? stats.ptPrice : ytPrice) * px), 2)}</b></div>
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
      {trade && (
        <details className="howto" id="howto">
          <summary>New to this? Three steps</summary>
          <ol>
            <li><b>Get a wallet.</b> MetaMask or Rabby, as a browser extension or a phone app. Then press Connect wallet above.</li>
            <li><b>Put some ETH in it on Robinhood Chain.</b> ETH is what you pay with, and it covers the small network fee. Move ETH over with the <a href="https://docs.robinhood.com/chain/bridging/" target="_blank" rel="noopener noreferrer">Robinhood Chain bridge</a>. Halve asks your wallet to switch to the right network.</li>
            <li><b>Pick, type an amount, press Buy.</b> Your p{t} or y{t} shows under Position right away. Sell it back the same way whenever you like, or set a price and let the order wait.</li>
          </ol>
        </details>
      )}
    </div>
    {trade && <Orders series={series} orders={limitH.orders} loading={limitH.ordersLoading} busy={limitH.busy} onClose={limitH.close} />}
  </>)
}
