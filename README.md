# Halve

Yield-splitting protocol frontend for tokenized stocks on **Robinhood Chain** (chain id 4663).
Splits a stock token into a principal token (PT, the share with dividends removed) and a yield
token (YT, the dividends with the share removed), with a free merge back at any time.

Next.js 15 (App Router) · TypeScript · Tailwind · wagmi v2 + viem + RainbowKit · TanStack Query.

## Quick start

```bash
pnpm install
cp .env.example .env.local   # defaults to MOCK=true
pnpm dev                     # http://localhost:3000
```

```bash
pnpm lint     # eslint
pnpm build    # production build (turbopack)
pnpm start
```

## Environment

| Variable | Default | Purpose |
|---|---|---|
| `MOCK` (or `NEXT_PUBLIC_MOCK`) | `true` | Render the prototype's mock numbers instead of reading chain 4663. Series whose addresses in `series.json` are still `0x000…` are mocked even when this is `false`. |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | placeholder | WalletConnect Cloud project id. MetaMask and Rabby work without it; the WalletConnect option needs a real id. |
| `NEXT_PUBLIC_RPC_URL` | viem default (`https://rpc.mainnet.chain.robinhood.com`) | Override the Robinhood Chain RPC. |
| `NEXT_PUBLIC_BLOCK_TIME_MS` | `100` | Average block time; sizes the 30-day swap-log window for the YT chart. |

Deploy target is Vercel: set the same variables in the project settings.

## Routes

| Route | Content |
|---|---|
| `/` | Hero, two-way cards, stats strip, markets table, how it works, why it holds, trust, FAQ, CTA |
| `/app` | Series selector, KPIs, YT price chart (30d), dividend ledger, Split / Merge / Earn panel, your position. Params: `?s=<index>`, `?side=yt`, `?tab=earn\|portfolio` |
| `/lend` | Morpho markets per PT |
| `/oracle` | Accountant status table + read API docs |
| `/token` | $HALVE revenue, allocation, stake, vote, supply |

## Going live: fill in `src/contracts/series.json`

Every series needs these addresses (all currently `0x0000…0000`):

| Field | Contract |
|---|---|
| `underlying` | ERC-8056 stock token |
| `vault` | StripVault |
| `pt`, `yt` | Principal / yield tokens |
| `accountant` | MultiplierAccountant |
| `poolPT`, `poolYT` | Uniswap v3 pools, quoted in the stock (never USD) |
| `priceFeed` | Chainlink stock/USD feed on chain 4663 (prices the token with the multiplier inside — the app never multiplies by `uiMultiplier` again) |

Plus `maturity` (unix ts), `cap` (raw units, string), `decimals`, and the optional presentation
fields `schedule` (oracle "Next scheduled" column) and `lend` (Morpho `maxLtv` / `borrowApr`).

Then set `MOCK=false`.

### ABIs

`src/contracts/abis/` holds **placeholder** ABIs written from the CLAUDE.md function list. Replace
`StripVault.ts`, `MultiplierAccountant.ts` and `StockToken.ts` with the compiled ABIs. Things the
placeholders assume that must be confirmed against the real contracts:

- `MultiplierAccountant.checkpointCount()` exists. If it does not, `useLedger` probes
  `checkpointAt(0..31)` and stops at the first revert.
- `checkpointAt(i)` returns `(ts, kind, ratio, indexAfter)` with `kind` 0 = dividend, 1 = split, 2 = special.
- `pending()` returns `(exists, ts, oldMultiplier, newMultiplier)` where `ts` is the queue time;
  the UI shows `ts + 2 days − now` as the remaining timelock (`GUARDIAN_TIMELOCK_SECONDS`).
- `StripVault.state()` is a `uint8` enum. Merge is never gated on it in the UI.

## Data flow

- `useAllSeriesStats` — one multicall for every live series (vault, accountant, both pools,
  decimals, Chainlink), polled every 12 s. Derives `ptPrice`, `ytPrice`, `fixedApy`, `leverage`,
  `capacityUsed`, `accrued`, `tvlUsd` client-side per CLAUDE.md.
- `useLedger` — `checkpointAt(i)` for every checkpoint, newest first, plus a gold "Held · timelock"
  row from `pending()`.
- `usePosition` — PT / YT / stock balances and vault allowances for the connected address.
  Accrued dividends = `ytBalance × (dividendIndex / d0 − 1) × usdPrice`. LP positions are phase 2.
- `useSplit` — `approve(vault)` if needed → `split(amount)`. `useMerge` — approve PT and YT if
  needed → `merge(amount)`. Both wait for receipts and show the prototype's toasts.
- `useYtHistory` — phase 1 chart: `Swap` events from the YT pool over the last 30 days
  (falls back to 7d / 1d if the RPC rejects the range). Phase 2: Vercel KV / Upstash series.

## Phase 2 (mock or static today)

- Earn router (quote only; the button toasts "quote only" outside mock mode).
- Morpho market reads on `/lend` (LTV / APR come from `series.json`; supplied / borrowed derive from TVL).
- 7-day TVL change and "dividends distributed" history (needs the KV series).
- `/token` revenue, ballot and supply figures (needs an indexer).
- LP balances in "Your position".
