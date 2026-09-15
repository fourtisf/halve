# Mainnet deployment

One series at a time, one command, run on a machine that holds the deployer key (the VPS is fine).
Nothing here needs to be typed into a chat or a browser.

## Why the pools are quoted in wStock

Robinhood's stock tokens rebase: a dividend raises every balance through `uiMultiplier`. Uniswap v3
does not support rebasing tokens; a positive rebase on tokens sitting in a pool is stuck there forever,
so LPs would silently lose the dividends of every share in the PT/stock and YT/stock pools. Halve
therefore quotes both pools in **wStock**, a non-rebasing wrapper (`contracts/src/WrappedStock.sol`,
one wStock = one share, like wstETH). PT + YT is a constant number of shares, so prices in wStock do
not drift with every dividend either. The app converts wStock prices back into stock units with
`uiMultiplier` (`quote: "wrapped"` in `series.json`). Quoting in the stock itself (`quote: "stock"`)
still works in the app but is not recommended on Uniswap v3.

## What you need before starting

| Input | Where it comes from |
|---|---|
| `STOCK` | The ERC-8056 stock token address on Robinhood Chain (must answer `uiMultiplier()`; the preflight checks). |
| `PRICE_FEED` | Chainlink stock/USD feed on chain 4663 (optional; USD values show $0 without it). |
| `NPM` | Uniswap v3 `NonfungiblePositionManager` on Robinhood Chain: `0x73991a25c818bf1f1128deaab1492d45638de0d3`. Leave empty to deploy the series without pools. |
| `TREASURY`, `GUARDIAN`, `OWNER` | Your addresses. Use a multisig for treasury and owner; the guardian must be able to act within days. |
| `MATURITY`, `CAP`, `TICKER` | Series parameters; `TICKER` must match an entry in `src/contracts/series.json`. |
| Deployer | A wallet with ETH for gas, and 2 × `SEED_AMOUNT` of the stock token if you seed liquidity. |

Do a full rehearsal on the Robinhood Chain testnet (chain id 46630) first with the same file and
`RPC_URL` / `CHAIN_ID` changed.

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
$EDITOR .env.mainnet                 # fill in the table above

# keep the key out of shell history: a keystore instead of DEPLOYER_KEY
cast wallet import halve --interactive
echo 'WALLET_ARGS=--account halve --password-file ~/.halve.pass' >> .env.mainnet

node scripts/mainnet.mjs --dry-run   # simulates every step, broadcasts nothing
node scripts/mainnet.mjs             # deploys, creates pools, updates series.json, runs check:live
```

What the command does, in order:

1. **Preflight**: chain id 4663, deployer balance, `STOCK.uiMultiplier()`, `PRICE_FEED.latestRoundData()`, code at `NPM`, `MATURITY` in the future, enough stock for seeding.
2. **`DeploySeries.s.sol`**: `MultiplierAccountant` (or reuse `ACCOUNTANT`) and `StripVault` with its `pJEPI` / `yJEPI` tokens. Verified on Blockscout when `VERIFY=1`.
3. **`DeployWrappedStock.s.sol`**: the wStock for this stock token (skipped when `WSTOCK` is given).
4. **`CreatePools.s.sol`**: PT/wStock and YT/wStock pools at `PT_PRICE` / `YT_PRICE`, fee tier `FEE`. With `SEED_AMOUNT`, `SeedPools` first splits that much stock (PT + YT) and wraps the same amount, then seeds both pools full-range.
5. **`scripts/apply-deployment.mjs`** writes every address plus `quote`, `quoteToken`, `maturity`, `cap`, `deployBlock` into `src/contracts/series.json`.
6. **`pnpm check:live`** proves every read the app makes answers, including that each pool pairs PT/YT with the wStock.

Then:

```bash
git add src/contracts/series.json && git commit -m "Deploy JEPI series to mainnet" && git push
# on the server
sed -i 's/^MOCK=.*/MOCK=false/' .env.local
pnpm build && pm2 restart halve --update-env
curl -fsS https://halve.finance/api/health | jq .   # ok: true, mock: false, series.live: 1
```

Walk through split → merge on mainnet with a small amount from a real wallet, and check the Portfolio
activity row links to Blockscout. Repeat per series.

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

- **Audit**: none yet. `/docs#security` and the Risk Disclosure say so; keep it that way until a report is linked.
- **Keeper**: someone must call `accountant.sync()` after each multiplier change (a cron with `cast send`, or any bot). Late is fine, the vault pauses splits meanwhile; merges never pause.
- **Liquidity**: seeding is capital you commit; without it the app shows no prices.

Two local rehearsals exist and run in CI: `pnpm test:e2e:live` (real Uniswap v3 factory + position
manager on anvil, wStock, seeded pools, split / merge / dividend through the UI) and
`pnpm rehearse:mainnet`, which runs `scripts/mainnet.mjs` itself, dry run and real, against anvil with a
generated `.env` and checks that `series.json` comes out filled.
