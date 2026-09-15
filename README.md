# Halve

Yield-splitting protocol frontend for tokenized stocks on **Robinhood Chain** (chain id 4663).
Splits a stock token into a principal token (PT, the share with dividends removed) and a yield
token (YT, the dividends with the share removed), with a free merge back at any time.

Next.js 15 (App Router) · TypeScript · Tailwind · wagmi v2 + viem + RainbowKit · TanStack Query ·
Vitest · Playwright · Foundry (contracts in `contracts/`).

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
pnpm contracts:test  # forge test (needs Foundry)
pnpm test:e2e:live   # anvil chain 4663 → deploy mocks → MOCK=false build → real split / merge / dividend in the browser
pnpm abis        # regenerate src/contracts/abis from contracts/out
```

CI (`.github/workflows/ci.yml`) runs three jobs on every push and pull request: the frontend checks
above, `forge build && forge test` (and fails if the committed ABIs drift from the compiled ones), and
the live anvil end-to-end run.

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
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` (or `UPSTASH_REDIS_REST_*`) | empty | Optional Redis for the YT price and TVL series. Without it, samples are stored as JSON files under `HISTORY_DIR` (default `./data/history`), which is fine for a single VPS. |
| `CRON_SECRET` | empty | Protects `/api/cron/sample`. |
| `NEXT_PUBLIC_MORPHO_BLUE` | empty | Morpho Blue address on 4663; enables live lend-market reads. |
| `NEXT_PUBLIC_DOCS_URL`, `…_CONTRACTS_URL`, `…_AUDIT_URL`, `…_API_URL` | `/docs`, `/docs#contracts`, `/docs#security`, `/docs#api` | Replace the built-in docs pages with external URLs. |
| `NEXT_PUBLIC_X_URL`, `…_TELEGRAM_URL`, `…_DISCORD_URL` | X defaults to `https://x.com/Halvefinance`, others `#` | Community links. |
| `BLOCKED_COUNTRIES` (server) | `US` | Comma-separated ISO alpha-2 list. `/app` and `/lend` redirect to `/restricted` when the edge sets a country header (`cf-ipcountry`, `x-vercel-ip-country`, `x-country-code`, `x-geo-country`). See docs/OPERATIONS.md. |
| `SERIES_FILE` (build) | empty | Path to a JSON file that replaces `src/contracts/series.json` at build time (local anvil / testnet deployments). |
| `NEXT_DIST_DIR` (build) | `.next` | Output directory, so a second build can sit next to the main one. |
| `GIT_SHA` (server) | empty | Reported by `/api/health`. |
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
| `/docs` | Protocol documentation: lifecycle, maths, fees, accountant rules, contract addresses (from `series.json`), integration interfaces, HTTP API, security status |
| `/legal/terms`, `/legal/privacy`, `/legal/risk` | Terms of Use, Privacy Notice, Risk Disclosure (linked from the footer and the wallet modal) |
| `/restricted` | Shown to blocked countries (see `BLOCKED_COUNTRIES`) |
| `/api/yt-history/:id` | `{ samples: [{ t, yt, tvl }] }` for the last 30 days (empty for undeployed series) |
| `/api/cron/sample` | Takes one slot0 / TVL sample per live series (Bearer `CRON_SECRET`) |
| `/api/health` | Liveness: mock flag, RPC reachability / latency / block, history backend, series counts. 503 when live mode can't reach the RPC |

The Portfolio tab (`/app?tab=portfolio`) also lists the wallet's activity (Split / Merge / Redeem
events read from every live vault, filtered by the indexed `account`) with a PnL per series: withdrawn
+ holdings at pool prices − deposited, in the stock token and in USD. Add `deployBlock` to a series in
`series.json` to bound the log scan.

## Contracts

`contracts/` is a Foundry project (solc 0.8.28, evm `paris`, forge-std vendored in `contracts/lib`).

| Contract | Role |
|---|---|
| `StripVault` | One per series. `split(amount)` takes 0.10 % and mints `base = net / factor()` PT + YT; `merge(base)` burns both and pays `base × factor()` in every state, never gated; `settle()` after maturity once the accountant is synced; `redeemPT` / `redeemYT` (5 % yield fee); `skim()` sends post-settlement surplus to the treasury. Owner can only change the cap and the treasury. |
| `MultiplierAccountant` | One per stock token. `sync()` (permissionless, idempotent) classifies each `uiMultiplier` change: 0 < r ≤ 3 % dividend, clean p/q ratio ≥ 20 % from 1 split, else held for the guardian behind a 2-day timelock (`resolvePending(kind)` accepts split or special only). Exposes `isSynced`, `dividendIndex`, `splitFactor`, `dividendIndexAt(ts)`, `pending()`, `checkpointCount()`, `checkpointAt(i)`. |
| `VaultToken` | PT / YT ERC-20, mint/burn by the vault only. |
| `HalveToken` | $HALVE: fixed 1 B supply to the treasury, `burn()` with a running `burned` counter. |
| `mocks/` | `MockStockToken` (ERC-8056 style: balance = shares × multiplier), `MockV3Pool` (`slot0`, `token0`, `Swap`), `MockAggregator` (Chainlink shape), vendored `Multicall3` for local chains. |

PT and YT are in *base units*: one base unit is one share as it stood when the series started
(`d0`, `s0`). `factor() = (dividendIndex / d0) × (splitFactor / s0)` is the stock per base unit right
now, so the vault holds exactly the shares deposited and the token's own rebasing keeps it backed.

```bash
cd contracts
forge build && forge test          # 26 tests incl. fuzz; FOUNDRY_SOLC=/path/to/solc if downloads are blocked
pnpm abis                          # from the repo root: copies compiled ABIs into src/contracts/abis
```

### Deploying a series

`docs/MAINNET.md` is the mainnet runbook: `node scripts/mainnet.mjs` deploys a series, its wStock quote
asset and the Uniswap v3 pools, writes `series.json` and runs the preflight, from a `.env.mainnet` file.

```bash
# 1. local: everything mocked on anvil (what `pnpm test:e2e:live` does)
anvil --chain-id 4663 &
cd contracts && OUT=series.local.json FUND=<your address> \
  forge script script/DeployMockSeries.s.sol --rpc-url http://127.0.0.1:8545 --broadcast --private-key <anvil key>
# then: SERIES_FILE=contracts/series.local.json MOCK=false NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545 pnpm build

# 2. testnet / mainnet: a real ERC-8056 stock token, one series
STOCK=0x… TICKER=JEPI MATURITY=1806451200 CAP=1000000000000000000000000 TREASURY=0x… GUARDIAN=0x… OWNER=0x… \
  forge script script/DeploySeries.s.sol --rpc-url $RPC --broadcast --private-key $KEY --verify
# ACCOUNTANT=0x… reuses an existing accountant for the same stock token.
# Create the PT/stock and YT/stock Uniswap v3 pools, seed them, and paste every address into src/contracts/series.json.
```

Robinhood Chain testnet is chain id 46630; deploy and run through the full lifecycle there (split,
dividend sync, held change + guardian resolve, maturity, settle, redeem) before mainnet.

### Go-live checklist

1. `forge test` green; ABIs regenerated (`pnpm abis`) and committed.
2. Series deployed and verified on Blockscout; pools created and seeded; Chainlink feed address confirmed.
3. `src/contracts/series.json` filled (all seven addresses + `priceFeed`, `maturity`, `cap`, `decimals`, `deployBlock`).
4. `pnpm check:live` passes from the production server.
5. `MOCK=false` in `.env.local`, `pnpm build`, `pm2 restart halve`, `/api/health` returns `ok: true` with `mock: false`.
6. Walk through split → merge on mainnet with a small amount from a real wallet; check the Portfolio activity row and the Blockscout link.
7. `BLOCKED_COUNTRIES` set and a country header present at the edge (Cloudflare or a GeoIP module), or accept that only the wallet-modal attestation gates access.
8. Audit: none yet. Say so on `/docs#security` until a report is linked via `NEXT_PUBLIC_AUDIT_URL`.


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

Then run `pnpm check:live` on the server: it proves the RPC, the chain id and every address answer the calls the app makes (and that each pool really pairs PT/YT with the stock). When it passes, set `MOCK=false`.

On a VPS, sample the chart series every 15 minutes with a crontab entry (read-through sampling from traffic works too):

```
*/15 * * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://halve.finance/api/cron/sample >/dev/null
```

### ABIs

`src/contracts/abis/StripVault.ts`, `MultiplierAccountant.ts`, `StockToken.ts` and `HalveToken.ts`
are generated from the compiled artifacts by `pnpm abis`; CI fails if they drift. The interface
contract the UI relies on: `checkpointAt(i)` → `(ts, kind, ratio, indexAfter)` with `kind`
0 dividend / 1 split / 2 special; `pending()` → `(exists, ts, oldMultiplier, newMultiplier)` with the
timelock shown as `ts + 2 days − now`; `state()` 0 Active / 1 Matured / 2 Settled; `redeemYT(base)`
pays `base × (sm / s0) × (dm / d0 − 1)` less 5 %. Merge is never gated on any of it.

## Operations

`docs/OPERATIONS.md` is the VPS runbook: update, rollback, pm2 (`ecosystem.config.cjs`) and log
rotation, `/api/health` monitoring, chart sampling cron, backups of `data/`, geo-blocking at the edge
and an incident checklist.

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

- Third-party audit of `contracts/`.
- Earn router (quote only; the button toasts "quote only" outside mock mode).
- Morpho borrow APR (needs the IRM); LP balances in "Your position" (needs the router).
- `/token` figures come from `src/content/token.json` until an indexer exists; set `contractAddress` there once $HALVE is deployed (empty = "coming soon").
- KV history needs a few days of samples before the 7 d TVL change is meaningful.
