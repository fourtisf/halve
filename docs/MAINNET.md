# Mainnet deployment

One series at a time, one command, run on a machine that holds the deployer key (the VPS is fine).
Nothing here needs to be typed into a chat or a browser.

## How the stock tokens behave, and what that means for the vault

Robinhood's stock tokens implement ERC-8056 ("scaled UI amount"): `balanceOf` and `totalSupply` never
change. Reinvested dividends and splits only move `uiMultiplier`, and wallets display
`raw × multiplier` shares (after a 5 % reinvested dividend one token shows as 1.05 shares). The vault
therefore accounts in raw tokens: split and merge are 1:1 in raw units, and at settlement PT redeems
`raw × d0 / dm` (its original share count) while YT redeems the rest (the shares the dividends
bought), less the 5 % fee. Because raw balances never rebase, the PT/stock and YT/stock Uniswap v3
pools need no wrapper. The tokens are freely transferable and usable by contracts.

## What you need before starting

| Input | Where it comes from |
|---|---|
| `STOCK` | Optional. Leave empty and the deployer resolves it from `TICKER` through Robinhood's asset registry, verifies `symbol()` and `uiMultiplier()` on-chain and pins it in `.env.mainnet`. A Blockscout search hit is only ever printed as a suggestion: check it on the explorer and set `STOCK=` yourself. `node scripts/find-stock.mjs SPY` does the lookup on its own. |
| `PRICE_FEED` | Chainlink stock/USD feed on chain 4663 (optional; USD values show $0 without it). |
| `NPM` | Uniswap v3 `NonfungiblePositionManager` on Robinhood Chain: `0x73991a25c818bf1f1128deaab1492d45638de0d3`. Leave empty to deploy the series without pools. |
| `TREASURY`, `GUARDIAN`, `OWNER` | Your addresses. Use a multisig for treasury and owner; the guardian must be able to act within days. |
| `MATURITY`, `CAP`, `TICKER` | Series parameters; `TICKER` must match an entry in `src/contracts/series.json`. |
| Deployer | A wallet with ETH for gas, and about 2 × `SEED_AMOUNT` of the stock token if you seed liquidity. |

Rehearse first: `pnpm rehearse:mainnet` (add `--keystore` for the keystore path) runs this exact pipeline,
the keeper, the smoke test and the pools-resume path against a local chain, and CI runs it on every push.
A testnet run (chain id 46630) works with `RPC_URL` / `CHAIN_ID` changed, but the registry lookup is
mainnet-only (set `STOCK=` by hand) and `apply-deployment` writes into the committed `series.json`, so
point `SERIES_FILE` at a scratch copy.

## Uniswap v3 on Robinhood Chain (chain id 4663)

Official deployment, as published in `@uniswap/sdk-core` (`ROBINHOOD_ADDRESSES`):

| Contract | Address |
|---|---|
| UniswapV3Factory | `0x1f7d7550b1b028f7571e69a784071f0205fd2efa` |
| NonfungiblePositionManager | `0x73991a25c818bf1f1128deaab1492d45638de0d3` |
| SwapRouter02 | `0xcaf681a66d020601342297493863e78c959e5cb2` |
| QuoterV2 | `0x33e885ed0ec9bf04ecfb19341582aadcb4c8a9e7` |
| TickLens | `0x7dfd4f31be6814d2906bde155c3e1b146eac1468` |

## Steps

```bash
cd ~/halve/halve
git pull && pnpm install --frozen-lockfile
cd contracts && forge build && forge test && cd ..

cp .env.mainnet.example .env.mainnet
# fill in the table above with sed, e.g.  sed -i 's/^TREASURY=.*/TREASURY=0x…/' .env.mainnet
# (inline "# comments" after a value are fine; use absolute paths, not ~)

# the key never touches the shell history or a command line: a keystore plus a password file
cast wallet import halve --interactive          # paste the private key when asked, choose a password
umask 077; printf %s 'that-password' > /root/.halve.pass
# .env.mainnet already says WALLET_ARGS=--account halve --password-file /root/.halve.pass

node scripts/mainnet.mjs --dry-run   # simulates every step, broadcasts nothing
node scripts/mainnet.mjs             # deploys, records, creates pools, runs check:live, verifies
```

A run refuses to start when a value is not a whole number, when the ticker is missing from
`series.json`, when that series already lists a vault (a second run would deploy a second vault; `--force`
overrides), when the token's `symbol()` or `decimals()` disagree with the ticker or `series.json`, when
`PT_PRICE + YT_PRICE` is not one share, when `SEED_AMOUNT` does not fit under `CAP`, when the fee tier is
not enabled on the factory, or when the deployer holds less than `MIN_GAS_ETH` (0.02 ETH).

What the command does, in order:

1. **Preflight**: `STOCK` resolved from the ticker when empty, chain id 4663, deployer balance, `STOCK.uiMultiplier()`, `PRICE_FEED.latestRoundData()`, code at `NPM`, `MATURITY` in the future, enough stock for seeding.
2. **`DeploySeries.s.sol`**: `MultiplierAccountant` (or reuse `ACCOUNTANT`, synced first) and `StripVault` with its `pSPY` / `ySPY` tokens. The addresses go into `series.json` immediately, before the pools, so nothing is ever deployed and unrecorded.
3. **`CreatePools.s.sol`**: PT/stock and YT/stock pools at `PT_PRICE` / `YT_PRICE`, fee tier `FEE`. With `SEED_AMOUNT`, `SeedPools` first splits that much stock (PT + YT), then seeds both pools full-range with stock as the quote.
4. **`scripts/apply-deployment.mjs`** writes every address plus `maturity`, `cap`, `deployBlock` into `src/contracts/series.json`.
5. **`pnpm check:live`** proves every read the app makes answers, including that each pool pairs PT/YT with the stock and that the stock answers `uiMultiplier()`.

Then:

```bash
git add src/contracts/series.json && git commit -m "Deploy SPY series to mainnet" && git push
# on the server
sed -i 's/^MOCK=.*/MOCK=false/' .env.local
pnpm build && pm2 restart halve --update-env
curl -fsS https://halve.finance/api/health | jq .   # ok: true, mock: false, series.live: 1
```

Then prove people can really buy, with a small amount of the stock token in the deployer wallet:

```bash
SMOKE_AMOUNT=1000000000000000000 node scripts/smoke-mainnet.mjs   # split 1 → sell 10 % of the PT and of the YT on Uniswap (quoted floor) → buy back → merge
```

It stops at the first step that misbehaves. Then walk through split → merge in the UI from a real wallet
and check the Portfolio activity row links to Blockscout. Repeat per series.

## If something fails half-way

- **DeploySeries reverted**: nothing is on chain and nothing is recorded; the forge output names the revert
  (a held accountant, a past maturity, a zero address). Fix the value and run again.
- **The pools step failed** (the vault cap, the token refusing a transfer to a contract, a pool somebody
  created first at another price): the vault is already in `series.json`. Fix the cause and run
  `node scripts/mainnet.mjs --resume-pools`; it skips the vault and only creates or seeds the pools.
- **Verification failed**: cosmetic. Run the same command again later; `--resume --verify` only talks to
  Blockscout.
- **`--dry-run` files**: written as `deployments/<TICKER>.*.dryrun.json`, never mistaken for a real record.

## Buying with ETH

The app's Buy tab routes `ETH → stock → PT/YT` through SwapRouter02, quoting every fee tier of the
WETH/stock pool and taking the best. It needs a WETH/stock Uniswap v3 pool with liquidity on Robinhood
Chain (Robinhood's tokens already trade there); when none exists for a series the button reads
"No ETH → pSPY route yet" and paying with the stock token still works. Addresses come from
`@uniswap/sdk-core` (`src/lib/chain.ts`); nothing to configure on mainnet.

## Keeper

Something must call `accountant.sync()` after each multiplier change:

```
PATH=/usr/local/bin:/usr/bin:/bin:/root/.foundry/bin
*/10 * * * * cd ~/halve/halve && flock -n /tmp/halve-keeper.lock node scripts/keeper.mjs >> /var/log/halve/keeper.log 2>&1
```

Cron's own `PATH` has neither `node` nor `cast`, hence the first line (adjust it to `which node` and
`which cast`); `flock` stops overlapping runs when the RPC is slow. The keeper exits non-zero when a change
is held or a sync fails, so a cron mail or a healthcheck ping on the exit code is the alert.

`sync()` is permissionless, so the keeper does not need the deployer key: give it its own low-value wallet
(`cast wallet import keeper --interactive`, a second env file with `WALLET_ARGS="--account keeper --password-file
~/.keeper.pass"` and `RPC_URL`, then `MAINNET_ENV=.env.keeper node scripts/keeper.mjs` in the cron line) and keep
the deployer keystore off the serving host once the series is live. The scripts refuse a plaintext `DEPLOYER_KEY`
against a remote RPC, because `cast send --private-key` exposes it to every process on the machine.

It reads `.env.mainnet` (or `MAINNET_ENV`) for the signer, compares `uiMultiplier()` with the accountant's `lastMultiplier()`
for every live series, and sends `sync()` when they differ. A held change shows up in the log and on
`/oracle`; after two days the guardian (and only the guardian) resolves it, 1 for a split or 2 for a special dividend:

```bash
cast send <accountant> "resolvePending(uint8)" 2 --rpc-url $RPC_URL --account guardian --password-file /root/.guardian.pass
```

`dismissPending()` drops a held change without applying it, for the case where the issuer corrected a wrong value.

## $HALVE token (optional, independent)

```bash
cd contracts
TREASURY=0x… forge script script/DeployHalveToken.s.sol --rpc-url $RPC_URL --broadcast --account halve --password-file ~/.halve.pass --verify --verifier blockscout --verifier-url https://robinhoodchain.blockscout.com/api/
```

Put the address in `src/content/token.json` (`contractAddress`) and the "coming soon" line on `/token`
becomes a Blockscout link. Any $HALVE/USDC pool is a separate decision; nothing in the code depends on it.

## Roles after deployment

| Role | Can | Cannot |
|---|---|---|
| Vault owner | `setCap`, `setTreasury`, `setOwner` | touch funds, pause, upgrade |
| Guardian | `resolvePending(kind)` after the 2-day timelock, split or special only | classify without timelock, move funds |
| Anyone | `sync()`, `settle()` after maturity, `skim()` surplus to treasury | — |

## Still open

- **Audit**: none yet. `docs/AUDIT-INTERNAL.md` is the implementing engineer's own review (findings fixed, limitations listed); it is not independent. `/docs#security` and the Risk Disclosure say so; keep it that way until a report is linked.
- **Keeper**: `scripts/keeper.mjs` on a cron (above). Late costs nothing at maturity any more: `settle()` pulls the token's latest multiplier into the index itself before freezing it. A held change pauses splits until the guardian acts; merges never pause.
- **Liquidity**: seeding is capital you commit; without it the app shows no prices.

Two local rehearsals exist and run in CI: `pnpm test:e2e:live` (real Uniswap v3 factory + position
manager on anvil, seeded pools, split / merge / dividend through the UI) and
`pnpm rehearse:mainnet`, which runs `scripts/mainnet.mjs` itself, dry run and real, against anvil with a
generated `.env` and checks that `series.json` comes out filled.

## Limit orders

The Trade tab's Limit option needs no extra contract: an order is a one-tick Uniswap v3 position minted
through the NonfungiblePositionManager (`NEXT_PUBLIC_UNISWAP_NPM`, default: the canonical deployment in the
table above) just below the market for a buy or above it for a sell. The pool converts it when the price
crosses the tick, at the limit or better, and the position earns the pool fee. "Claim" and "Cancel" are the
same call: `multicall([decreaseLiquidity, collect, burn])`, which returns whatever the position holds to the
wallet. The app lists a wallet's one-tick positions in the PT and YT pools as its orders; the buy/sell side
is remembered in the browser at placement and otherwise read back from the position's `IncreaseLiquidity`
event (the RPC must serve `eth_getLogs` from the series' `deployBlock`). A filled order that is not claimed
converts back if the price crosses the tick again; the UI says so under the orders list.
