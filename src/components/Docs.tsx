import Link from 'next/link'
import { zeroAddress } from 'viem'
import { SERIES, hasPlaceholderAddresses } from '@/contracts/types'
import { CHAIN_ID, explorerAddress } from '@/lib/chain'
import { monthYear } from '@/lib/format'
import { Prose } from './Prose'

const TOC = [
  ['overview', 'Overview'], ['lifecycle', 'Lifecycle'], ['maths', 'Maths'], ['fees', 'Fees'], ['oracle', 'Corporate actions'],
  ['contracts', 'Contracts'], ['integrate', 'Integrate'], ['api', 'API'], ['security', 'Security'], ['run', 'Run it yourself'],
] as const

function Addr({ a }: { a: `0x${string}` }) {
  if (a === zeroAddress) return <span className="m">not deployed</span>
  return <a href={explorerAddress(a)} target="_blank" rel="noopener noreferrer" className="mono" style={{ textDecoration: 'none' }}>{a.slice(0, 6)}…{a.slice(-4)}</a>
}

/** /docs — protocol documentation rendered from the code and series.json, so it can't drift from what is deployed. */
export function Docs() {
  const live = SERIES.filter((s) => !hasPlaceholderAddresses(s))
  return (
    <Prose kicker="Documentation" title="How Halve works, from the contracts up." updated={null} wide>
      <ul className="toc">{TOC.map(([id, label]) => <li key={id}><a href={`#${id}`}>{label}</a></li>)}</ul>

      <h3 id="overview">Overview</h3>
      <p>Halve splits a tokenized stock or ETF on Robinhood Chain (chain id {CHAIN_ID}) into two tokens with a fixed maturity date:</p>
      <ul>
        <li><strong>PT, the principal token</strong> (<code>p</code>TICKER): the share with its dividends removed. At maturity one PT redeems for one share of the stock token. Before maturity it trades at a discount, which is the fixed yield.</li>
        <li><strong>YT, the yield token</strong> (<code>y</code>TICKER): every dividend the share pays between now and maturity, and nothing else. At maturity it redeems for the accrued dividends, less the yield fee.</li>
      </ul>
      <p>One share in gives one PT and one YT out. Holding both at any time and merging them gives the share back, for free, in every state of the series. Nothing is claimed along the way: dividends compound inside the stock token itself and are paid once, at maturity.</p>

      <h3 id="lifecycle">Lifecycle of a series</h3>
      <div className="tbl"><table>
        <thead><tr><th>State</th><th>Split</th><th>Merge</th><th>Settle</th><th>Redeem</th></tr></thead>
        <tbody>
          <tr><td>Active (before maturity)</td><td>open, unless the accountant is holding a change</td><td>open</td><td>—</td><td>—</td></tr>
          <tr><td>Matured (after maturity, before settle)</td><td>closed</td><td>open</td><td>anyone, once the accountant is synced</td><td>—</td></tr>
          <tr><td>Settled</td><td>closed</td><td>open, at the settled factor</td><td>done</td><td>PT → share, YT → dividends − 5%</td></tr>
        </tbody>
      </table></div>
      <p>Merge is never gated: not by pool liquidity, not by a held corporate action, not by maturity. That is the guarantee that makes PT + YT always worth at least one share.</p>
      <p>Trading happens on Uniswap v3: each series has a PT/stock and a YT/stock pool. The app&apos;s Buy tab routes ETH → stock → PT or YT through SwapRouter02 in one transaction, quoted by QuoterV2 across fee tiers; paying with the stock token is a single hop.</p>

      <h3 id="maths">Maths</h3>
      <p>Robinhood&apos;s stock tokens follow ERC-8056: the raw <code>balanceOf</code> never changes. Reinvested dividends and splits only move <code>uiMultiplier</code>, and wallets display <em>raw × multiplier</em> shares. Halve therefore accounts in raw tokens, and the accountant splits the multiplier&apos;s history into <code>dividendIndex</code> (D, reinvested dividends) and <code>splitFactor</code> (S, splits), both 1e18 = 1.0.</p>
      <pre>{`split(amount) : base = amount − 0.10 %            →  base PT + base YT   (raw units)
merge(base)   : base raw tokens back              free, any state
settle()      : dm = D                            after maturity, once isSynced()
redeemPT(base): base × d0 / dm raw                the original share count (splits cancel out)
redeemYT(base): base × (dm − d0) / dm raw − 5 %   the reinvested dividends`}</pre>
      <p>One raw token is worth <em>uiMultiplier</em> shares, so a PT that redeems <code>d0 / dm</code> raw tokens redeems exactly the share count it started with, and the YT gets the shares the dividends bought. The interface derives its headline numbers from on-chain reads only:</p>
      <pre>{`ptPrice   = PT/stock pool price, raw stock per PT (Uniswap v3 slot0, orientation by token0)
principal = d0 / dividendIndex = 1 / (1 + accrued)   raw tokens one PT redeems today
fixedApy  = (principal / ptPrice) ^ (1 / yearsToMaturity) − 1
leverage  = 1 / ytPrice
accrued   = dividendIndex / d0 − 1
usd       = Chainlink feed: USD per raw token, multiplier already inside (never multiplied again)`}</pre>

      <h3 id="fees">Fees</h3>
      <div className="tbl"><table>
        <thead><tr><th>Action</th><th>Fee</th><th>Taken in</th></tr></thead>
        <tbody>
          <tr><td>Split</td><td>0.10 %</td><td>the stock token, once, on the way in</td></tr>
          <tr><td>Merge</td><td>0</td><td>—</td></tr>
          <tr><td>Redeem PT</td><td>0</td><td>—</td></tr>
          <tr><td>Redeem YT</td><td>5 % of the dividends</td><td>the stock token, at redemption</td></tr>
        </tbody>
      </table></div>
      <p>Fees go to the treasury address of each vault. The vault owner can change the cap and the treasury address and nothing else.</p>

      <h3 id="oracle">Corporate actions: the accountant</h3>
      <p>One <code>MultiplierAccountant</code> per stock token watches the multiplier and classifies every change by rule. <code>sync()</code> is permissionless and idempotent, so a keeper can be late but never wrong.</p>
      <ul>
        <li><strong>Dividend</strong>: growth of 0 &lt; r ≤ 3 %. Applied immediately: D ×= r.</li>
        <li><strong>Split</strong>: a clean small-integer ratio (p/q with q ≤ 20, p ≤ 100) at least 20 % away from 1. Applied immediately: S ×= r.</li>
        <li><strong>Everything else</strong> (special dividends, odd ratios, stacked actions): held. <code>isSynced()</code> turns false, splitting and settlement pause, merging continues at the stale factor. After a public two-day timelock the guardian resolves it as a split or a special dividend; a plain dividend tag is rejected because the band would have caught it.</li>
      </ul>
      <p>Every applied change is a checkpoint <code>(ts, kind, ratio, indexAfter)</code>; <code>dividendIndexAt(ts)</code> binary-searches them, so any contract can settle against the index at a past timestamp.</p>

      <h3 id="contracts">Contracts</h3>
      <p>Source: <code>contracts/</code> in the repository (Foundry, MIT). Deployed addresses come straight from <code>src/contracts/series.json</code>, the same file the app reads; a series is live only when every address is filled in.</p>
      <div className="tbl"><table id="ctable">
        <thead><tr><th>Series</th><th>Maturity</th><th>Stock</th><th>Vault</th><th>PT</th><th>YT</th><th>Accountant</th><th>Pools PT / YT</th><th>Feed</th></tr></thead>
        <tbody>
          {SERIES.map((s) => (
            <tr key={s.id}>
              <td>{s.ticker}</td><td>{monthYear(s.maturity)}</td>
              <td><Addr a={s.underlying} /></td><td><Addr a={s.vault} /></td><td><Addr a={s.pt} /></td><td><Addr a={s.yt} /></td><td><Addr a={s.accountant} /></td>
              <td><Addr a={s.poolPT} /> / <Addr a={s.poolYT} /></td><td><Addr a={s.priceFeed} /></td>
            </tr>
          ))}
        </tbody>
      </table></div>
      <p>{live.length === 0 ? <>No series is deployed to mainnet yet; the interface runs on mock data until the addresses above are filled in. Contracts are announced on <a href="https://x.com/Halvefinance" target="_blank" rel="noopener noreferrer">X</a> first.</> : <>{live.length} of {SERIES.length} series are live.</>} Shared infrastructure on chain {CHAIN_ID}: Multicall3 <code>0xcA11…CA11</code>, block explorer <a href="https://robinhoodchain.blockscout.com" target="_blank" rel="noopener noreferrer">robinhoodchain.blockscout.com</a>.</p>

      <h3 id="integrate">Integrate</h3>
      <p>The accountant is the free part. Wire it into any contract that holds a stock token:</p>
      <pre>{`interface IMultiplierAccountant {
    function isSynced() external view returns (bool);          // pause on false
    function dividendIndex() external view returns (uint256);  // 1e18 = 1.0
    function splitFactor() external view returns (uint256);    // 1e18 = 1.0
    function dividendIndexAt(uint256 ts) external view returns (uint256);
    function pending() external view returns (bool exists, uint64 ts, uint256 oldMultiplier, uint256 newMultiplier);
    function checkpointCount() external view returns (uint256);
    function checkpointAt(uint256 i) external view returns (uint64 ts, uint8 kind, uint256 ratio, uint256 indexAfter);
}

interface IStripVault {
    function split(uint256 amount) external returns (uint256 base);   // approve the stock token first
    function merge(uint256 base) external returns (uint256 amount);
    function settle() external;
    function redeemPT(uint256 base) external returns (uint256 amount);
    function redeemYT(uint256 base) external returns (uint256 amount);
    function principalPerPT() external view returns (uint256);        // raw tokens per PT, 1e18 = 1.0
    function state() external view returns (uint8);                   // 0 active · 1 matured · 2 settled
}`}</pre>
      <p>Full ABIs are generated into <code>src/contracts/abis/</code> from the compiled artifacts (<code>pnpm abis</code>).</p>

      <h3 id="api">HTTP API</h3>
      <div className="tbl"><table>
        <thead><tr><th>Endpoint</th><th>Returns</th></tr></thead>
        <tbody>
          <tr><td className="mono">GET /api/yt-history/:seriesId</td><td><code>{'{ samples: [{ t, yt, tvl }] }'}</code> — YT price in stock and TVL in USD, sampled every 10 minutes over the last 30 days. Empty for series that are not deployed.</td></tr>
          <tr><td className="mono">GET /api/health</td><td>Liveness for monitors: mock flag, RPC reachability and latency, latest block, history backend, series counts. 503 when the RPC is unreachable in live mode.</td></tr>
          <tr><td className="mono">GET /api/cron/sample</td><td>Takes one sample per live series (Bearer <code>CRON_SECRET</code>).</td></tr>
        </tbody>
      </table></div>
      <p>Everything else is read directly from chain by the browser, through the RPC in <code>NEXT_PUBLIC_RPC_URL</code>, polled every 12 seconds.</p>

      <h3 id="security">Security</h3>
      <ul>
        <li><strong>Audit</strong>: none yet. The contracts are covered by unit and fuzz tests (<code>forge test</code>) and an end-to-end run against a local chain, which is not the same thing. Treat every series as unaudited until an audit report is linked here.</li>
        <li><strong>Privileges</strong>: the vault owner can set the cap and the treasury. The accountant guardian can resolve a held change after the two-day timelock, into a split or a special dividend only. No pause, no upgrade, no fund movement, no admin mint.</li>
        <li><strong>Disclosure</strong>: report vulnerabilities privately via DM on <a href="https://x.com/Halvefinance" target="_blank" rel="noopener noreferrer">X</a> before publishing. Please do not exploit on mainnet.</li>
      </ul>

      <h3 id="run">Run it yourself</h3>
      <pre>{`git clone <repo> && cd halve && pnpm install
pnpm dev                   # mock mode, http://localhost:3000
cd contracts && forge test # 26 contract tests
pnpm test:e2e:live         # anvil (chain 4663) → deploy → MOCK=false build → Playwright split/merge/dividend`}</pre>
      <p>The interface never needs this site to exist: with the addresses above and any wallet you can call <code>merge</code> or <code>redeemPT</code> on the explorer directly. See the <Link href="/legal/risk">Risk Disclosure</Link> and <Link href="/legal/terms">Terms of Use</Link>.</p>
    </Prose>
  )
}
