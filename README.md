# Halve

Yield-splitting protocol frontend for tokenized stocks on **Robinhood Chain** (chain id 4663).
Splits a stock token into a principal token (PT, the share with dividends removed) and a yield
token (YT, the dividends with the share removed), with a free merge back at any time.

Next.js 15 (App Router) · TypeScript · Tailwind · wagmi v2 + viem + RainbowKit · TanStack Query ·
Vitest · Playwright.

## Quick start

```bash
pnpm install
cp .env.example .env.local   # defaults to MOCK=true
pnpm dev                     # http://localhost:3000
```

```bash
pnpm lint        # eslint
pnpm typecheck   # tsc --noEmit
pnpm test        # vitest unit tests (maths, parsing, ledger, history, formatting)
pnpm build       # production build (turbopack)
pnpm test:e2e    # playwright against `pnpm start` (run `pnpm build` first)
pnpm check       # lint + typecheck + test + build
```

CI (`.github/workflows/ci.yml`) runs all of the above on every push and pull request.

In mock mode the wallet picker offers a **Demo wallet** (wagmi mock connector, address
`0x7A3f…C32F`) so the connected state, Split / Merge / Earn and the Portfolio tab can be exercised
without a browser extension. The e2e suite uses it.

## Environment

| Variable | Default | Purpose |
|---|---|---|
| `MOCK` (or `NEXT_PUBLIC_MOCK`) | `true` | Render the prototype's mock numbers instead of reading chain 4663. Series whose addresses in `series.json` are still `0x000…` are mocked even when this is `false`. |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | empty | WalletConnect Cloud project id. The WalletConnect option is hidden until set; MetaMask and Rabby work without it. |
| `NEXT_PUBLIC_RPC_URL` | viem default (`https://rpc.mainnet.chain.robinhood.com`) | Override the Robinhood Chain RPC. |
| `NEXT_PUBLIC_BLOCK_TIME_MS` | `100` | Average block time; sizes the swap-log window of the chart fallback. |
| `NEXT_PUBLIC_SITE_URL` | `https://halve.finance` | Canonical URL for metadata, OG image, robots and sitemap (Vercel previews use their own URL). |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` (or `UPSTASH_REDIS_REST_*`) | empty | Vercel KV / Upstash Redis for the YT price and TVL series. |
| `CRON_SECRET` | empty | Protects `/api/cron/sample`. |
| `NEXT_PUBLIC_MORPHO_BLUE` | empty | Morpho Blue address on 4663; enables live lend-market reads. |
| `NEXT_PUBLIC_DOCS_URL`, `…_CONTRACTS_URL`, `…_AUDIT_URL`, `…_API_URL`, `…_X_URL`, `…_TELEGRAM_URL`, `…_DISCORD_URL` | `#` | Footer / nav links. |
| `NEXT_PUBLIC_ERROR_ENDPOINT` | empty | Receives JSON error reports from the error boundaries. |

Deploy target is Vercel at **halve.finance**: import the repo, set the same variables in the project settings, add the domain, and point Hostinger DNS at Vercel (`A @ 76.76.21.21`, `CNAME www cname.vercel-dns.com`). `vercel.json` schedules
`/api/cron/sample` every 15 minutes (Pro plan; Hobby allows daily crons, but the history API also
samples read-through, so the series fills from traffic alone).

## Routes

| Route | Content |
|---|---|
| `/` | Hero, two-way cards, stats strip, markets table, how it works, why it holds, trust, FAQ, CTA |
| `/app` | Series selector, KPIs, YT price chart (30d), dividend ledger, Split / Merge / Earn panel (+ Redeem after maturity), your position. Params: `?s=<index>`, `?side=yt`, `?tab=earn\|portfolio` |
| `/lend` | Morpho markets per PT |
| `/oracle` | Accountant status table + read API docs |
| `/token` | $HALVE revenue, allocation, stake, vote, supply (`src/content/token.json`) |
| `/api/yt-history/:id` | `{ samples: [{ t, yt, tvl }] }` for the last 30 days (503 until KV is configured) |
| `/api/cron/sample` | Takes one slot0 / TVL sample per live series (Bearer `CRON_SECRET`) |

## Going live: fill in `src/contracts/series.json`

Every series needs these addresses (all currently `0x000…0000`):

| Field | Contract |
|---|---|
| `underlying` | ERC-8056 stock token |
| `vault` | StripVault |
| `pt`, `yt` | Principal / yield tokens |
| `accountant` | MultiplierAccountant |
| `poolPT`, `poolYT` | Uniswap v3 pools, quoted in the stock (never USD) |
| `priceFeed` | Chainlink stock/USD feed on chain 4663 (prices the token with the multiplier inside — the app never multiplies by `uiMultiplier` again) |

Plus `maturity` (unix ts), `cap` (raw units, string), `decimals`, and the optional fields
`schedule` (oracle "Next scheduled" column), `lend` (`maxLtv`, `borrowApr`, `loanDecimals`) and
`morphoMarketId` (bytes32, enables live Morpho reads together with `NEXT_PUBLIC_MORPHO_BLUE`).

Then set `MOCK=false`.

### ABIs and assumptions to confirm

`src/contracts/abis/` holds **placeholder** ABIs written from the CLAUDE.md function list. Replace
`StripVault.ts`, `MultiplierAccountant.ts` and `StockToken.ts` with the compiled ABIs. The UI
assumes, and the unit tests encode, the following — confirm each against the real contracts:

- `MultiplierAccountant.checkpointCount()` exists. If it does not, `useLedger` probes
  `checkpointAt(0..31)` and stops at the first revert.
- `checkpointAt(i)` returns `(ts, kind, ratio, indexAfter)` with `kind` 0 = dividend, 1 = split, 2 = special.
- `pending()` returns `(exists, ts, oldMultiplier, newMultiplier)` where `ts` is the queue time;
  the UI shows `ts + 2 days − now` as the remaining timelock (`GUARDIAN_TIMELOCK_SECONDS`).
- `StripVault.state()` is `0 Active, 1 Matured, 2 Settled`. Merge is never gated on it in the UI.
- After maturity: `settle()` is callable by anyone once; `redeemPT(amount)` pays `amount` shares;
  `redeemYT(amount)` pays `amount × (dividendIndex / d0 − 1)` shares minus the 5 % yield
  redemption fee (`YIELD_REDEMPTION_FEE`). See `src/lib/redeem.ts`.

## Data flow

- `useAllSeriesStats` — one multicall for every live series (vault, accountant, both pools,
  decimals, Chainlink), polled every 12 s. Parsing lives in `src/lib/stats.ts` (unit-tested) and
  derives `ptPrice`, `ytPrice`, `fixedApy`, `leverage`, `capacityUsed`, `accrued`, `tvlUsd`.
  Errors surface as an inline banner; loading states render skeletons.
- `useLedger` — `checkpointAt(i)` for every checkpoint, newest first, plus a gold "Held · timelock"
  row from `pending()` (`src/lib/ledger.ts`).
- `usePosition` / `useAllPositions` — PT / YT / stock balances and vault allowances for the
  connected address, per series and for the Portfolio tab. Accrued dividends =
  `ytBalance × (dividendIndex / d0 − 1) × usdPrice`.
- `useSplit` / `useMerge` / `useRedeem` — approve-then-call flows on a shared `useTx` runner that
  waits for receipts, shows the prototype's toasts, links the tx on Blockscout and refetches
  on-chain reads only. Amounts are validated against balances before the button enables.
- `useYtHistory` — reads the KV series via `/api/yt-history/:id` (sampled slot0 + TVL, resampled
  to 31 points, 24 h and 7 d changes). Falls back to Uniswap `Swap` events (30d → 7d → 1d) when
  KV is not configured.
- `useMorphoMarkets` — `market(id)` / `idToMarketParams(id)` on Morpho Blue when configured.

## Brand assets

The logo ("Stack": two paper bars for the share, one gold bar lifted off the top for the dividend)
lives in `public/brand/` as SVG and PNG, served at `/brand/<file>`. `src/components/Logo.tsx`
renders the same mark inline; `src/app/icon.svg` and `src/app/apple-icon.png` are the favicons and
`src/app/opengraph-image.tsx` the social card. Usage rules are in `public/brand/README.txt`:
clear space of one bar height, 16 px minimum, never rotated or gradiented, and the gap never closes.

## Still phase 2

- Earn router (quote only; the button toasts "quote only" outside mock mode).
- Morpho borrow APR (needs the IRM); LP balances in "Your position" (needs the router).
- `/token` figures come from `src/content/token.json` until an indexer exists.
- KV history needs a few days of samples before the 7 d TVL change is meaningful.
