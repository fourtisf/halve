'use client'
import type { Series } from '@/contracts/types'
import type { Order } from '@/hooks/useLimitOrders'
import { f } from '@/lib/format'

/** "Your orders" — the wallet's limit orders on this series: what they wait for, what they hold, one button each. */
export function Orders({ series, orders, loading, busy, onClose }: { series: Series; orders: Order[]; loading: boolean; busy: boolean; onClose: (o: Order) => void }) {
  const t = series.ticker
  const sym = (o: Order) => `${o.token === 'pt' ? 'p' : 'y'}${t}`
  return (
    <div className="panel" style={{ marginTop: 16 }}>
      <h4>Your orders{orders.length ? <span>{orders.length} open</span> : null}</h4>
      <div id="orders" className="orders">
        {orders.length === 0 ? (
          <div className="row"><span className="m">{loading ? 'Loading…' : 'No orders. Set a price on the Trade tab to place one.'}</span></div>
        ) : orders.map((o) => {
          const what = o.side === 'buy'
            ? `Buy ${sym(o)} at ≤ ${f(o.priceHigh, 4)} ${t}`
            : o.side === 'sell'
              ? `Sell ${sym(o)} at ≥ ${f(o.priceLow, 4)} ${t}`
              : `Position ${f(o.priceLow, 4)}–${f(o.priceHigh, 4)} ${t}`
          const holds = o.side === null
            ? `holds ${f(o.amountToken, 4)} ${sym(o)} + ${f(o.amountStock, 4)} ${t}`
            : o.status === 'filled'
            ? o.side === 'buy' ? `${f(o.amountToken, 4)} ${sym(o)} ready` : `${f(o.amountStock, 4)} ${t} ready`
            : o.status === 'partial'
              ? `${Math.round(o.progress * 100)}% filled · ${f(o.amountToken, 4)} ${sym(o)} + ${f(o.amountStock, 4)} ${t}`
              : o.side === 'buy' ? `waiting with ${f(o.amountStock, 4)} ${t}` : `waiting with ${f(o.amountToken, 4)} ${sym(o)}`
          const action = o.side === null ? 'Close' : o.status === 'filled' ? 'Claim' : o.status === 'partial' ? 'Close' : 'Cancel'
          return (
            <div className="row" key={o.key} data-status={o.status}>
              <div>
                <b>{what}</b>
                <span className={o.side === null ? 'm' : o.status === 'filled' ? 'g' : o.status === 'partial' ? 'y' : 'm'}>{o.side === null ? 'Position' : o.status === 'filled' ? 'Filled' : o.status === 'partial' ? 'Filling' : 'Open'} · {holds}</span>
              </div>
              <button className={`btn btn-sm ${o.status === 'filled' ? 'btn-white' : 'btn-line'}`} disabled={busy} onClick={() => onClose(o)}>{action}</button>
            </div>
          )
        })}
      </div>
      {orders.length > 0 && <div className="note">A filled order is converted by the pool, not moved to your wallet: press Claim to collect it. If the price crosses back before you claim, the pool converts it back.</div>}
    </div>
  )
}
