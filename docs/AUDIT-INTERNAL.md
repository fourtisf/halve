# Internal security review — Halve contracts

**Status: internal review by the implementing engineer. Not an independent audit.** Do not treat
this document as one. Until a third-party report is linked from `/docs#security`, every series is
unaudited and the Risk Disclosure says so.

Scope: `contracts/src/StripVault.sol`, `MultiplierAccountant.sol`, `VaultToken.sol`, `HalveToken.sol`,
`libraries/PriceMath.sol`, the deploy scripts under `contracts/script/`, and the assumptions the
frontend makes about them. Commit: see `git log` for the review date.

## Method

- Line-by-line read of every state change with the questions: who can call it, what can re-enter it,
  what happens on rounding, what happens if the accountant is wrong or absent, what happens if the
  stock token misbehaves (fee on transfer, reverting transfer, multiplier going down).
- 41 Foundry tests including fuzzed conservation (`split → merge` and `redeemPT + redeemYT + fee == deposit`),
  a reentrant stock token, a negative multiplier adjustment, and an absent guardian.
- End-to-end rehearsal on anvil with the real Uniswap v3 factory, position manager and SwapRouter02
  from the published artifacts: deploy → seed pools → split, sell PT, buy back, merge (`pnpm rehearse:mainnet`).

## The model the contracts rely on

Robinhood stock tokens are ERC-20 + ERC-8056: `balanceOf` and `totalSupply` never change; reinvested
dividends and splits move `uiMultiplier` only (one raw token = multiplier shares). Verified from
Robinhood's own documentation and two independent analyses (Beosin, SQD) and from the registry
(`currentMultiplier` per asset). The vault therefore accounts in raw tokens and never expects its
balance to grow. If a future token did rebase balances, the vault would still be solvent (extra
balance is surplus, skimmable), but PT/YT pricing in the app would be off.

## Findings and what was done

| # | Severity | Finding | Status |
|---|---|---|---|
| 1 | **High** (pre-review design) | Vault assumed stETH-style rebasing balances; `merge` would have paid `base × factor` raw tokens and drained the vault after the first dividend. | Fixed: raw-unit accounting throughout; conservation fuzz test. |
| 2 | Medium | `redeemYT` underflowed (`WAD − principalPerPT`) if the guardian booked a *negative* multiplier adjustment as special, pushing `dividendIndex` below `d0`. | Fixed: `principalPerPT` capped at 1.0; PT keeps the whole raw unit, YT gets 0. Tested. |
| 3 | Medium | An absent guardian could keep a series unsettleable forever (held change at maturity). Merge stayed available, but lone PT or YT holders had no exit. | Fixed: `settle()` allowed 30 days after maturity regardless (`FORCE_SETTLE_DELAY`); the held change then favours PT. Tested. |
| 4 | Low | No reentrancy guard; the stock token is an upgradeable contract we do not control. | Fixed: `nonReentrant` on split / merge / redeem / skim; test with a re-entering token. |
| 5 | Low | `setGuardian(0)` and a zero guardian at construction were possible, silently disabling resolution. | Fixed: zero-address checks. |
| 6 | Low | Vault owner role was not transferable (no way to move to a multisig). | Fixed: `setOwner`, never to zero. |
| 7 | Info | `split` trusts the amount received: computed from balance before/after, so a fee-on-transfer token cannot mint unbacked PT/YT. | Already correct; kept. |
| 8 | Info | `_pay` clamps payouts to the vault balance. With raw accounting this can only bite on rounding dust; it can never mask a real deficit because liabilities are the raw balance by construction. | Kept, documented. |

## Known limitations (accepted, documented)

- **A special dividend of exactly a clean ratio** (say +25 %) is auto-classified as a 5:4 split and
  its value goes to PT, not YT. Clean ratios ≥ 20 % from 1 are overwhelmingly splits; the guardian
  cannot override an automatic classification. Consider a `reclassify` with its own timelock later.
- **Guardian discretion** on held changes decides how value is shared between PT and YT. Mitigated
  by the public two-day timelock and the force-settle fallback; not by code beyond that.
- **Cap is in raw units**, so it is not a USD cap; set it per series with the token's price in mind.
- **The accountant needs a keeper** (`scripts/keeper.mjs`). Late is harmless (splits pause), but a
  held change still needs a human.
- **Pool prices are what they are**: `fixedApy` and `leverage` are market-implied from Uniswap v3
  `slot0`; a thin pool prints thin numbers. The app never gates merge on them.

## What is still not verified on mainnet

1. That Robinhood's SPY token accepts transfers to and from arbitrary contracts (vault, position
   manager, pool). Documentation says tokens are freely usable in DeFi; a third-party guide mentions
   compliance checks. `scripts/smoke-mainnet.mjs` settles this with real funds: split → swap → merge.
2. That the token's multiplier moves the way the accountant expects (dividend growth ≤ 3 %, splits
   as clean ratios). The registry shows `currentMultiplier: 1.0` for SPY today; the first real
   dividend is the first real test. Watch the keeper log and the oracle page after the first ex-date.
3. Gas cost of deployment and of a pool creation on Robinhood Chain (estimates only until the first run).

## Recommendations before opening to the public

1. Independent audit of `StripVault` and `MultiplierAccountant` (small codebase, ~400 lines).
2. Multisig for owner and treasury (`setOwner`, `setTreasury`) after deployment; guardian on a
   wallet that can act within two days.
3. Start with a low `cap` and raise it (`setCap`) once the first dividend cycle has been observed.
4. Keep `/docs#security` honest until the audit report exists.

## Second review (four independent passes; every item below is fixed and tested)

| Area | Finding | Fix |
|---|---|---|
| Vault | `settle()` froze whatever index the accountant had; a dividend the keeper had not synced went to PT, and whoever won the `settle()` vs `sync()` race decided it. | `settle()` syncs the accountant first; a change that needs the guardian blocks settlement until resolved (or the 30-day fallback plus the guardian's 2-day window). |
| Vault | `d0` could be copied from a stale or held accountant at construction. | Constructor requires a synced accountant whose `lastMultiplier` equals the token's; `DeploySeries` syncs a reused accountant first. |
| Vault | `_pay` silently paid less than owed if the vault's tokens had been moved. | Reverts with `Vault: shortfall` beyond 2 wei of rounding. |
| Accountant | A zero multiplier read could be held and then applied, bricking `sync()`; no way to drop a held change. | `sync()` and `resolvePending()` refuse zero; guardian `dismissPending()`; sub-1e-9 jitter is ignored. |
| Pools | `createAndInitializePoolIfNecessary` accepted a pool somebody created first at any price, and the seed was minted with zero minimums. | The script requires the pool price within 1 % of the intended one and mints with 99 % minimums. |
| Pipeline | Inline `# comments` in `.env.mainnet` were read as part of the value; `~` was not expanded; a truthy `VERIFY` aborted the run after a successful deploy; nothing stopped a second run from deploying a second vault; Blockscout search hits were pinned unverified. | Shared parser with tests; value validation; series.json target and duplicate guard; record before pools; verification after the fact; Blockscout as suggestion only; `--resume-pools`. |
| App | `Max` rounded up and could exceed the balance; the signer was not pinned across a multi-step flow; a click during the allowance read could start a second flow; a cancelled transaction counted as success; a comma in the limit price was silently misread. | Floor to 4 dp; `account` pinned; `busy` covers the whole flow; cancellations rejected; strict price parsing. |
| Site | The geo-block trusted any of four headers, so a client could add one; the cron route was open without a secret; concurrent history writes shared a temp file. | One trusted header (`GEO_HEADER`), fail-closed cron with a constant-time compare, unique temp files and serialised appends. |

Not changed, by design or deferred: a split and a dividend inside one keeper interval still need the guardian
(`resolvePending` cannot decompose them); fees to the treasury stay on the split / redeem path (owner can
`setTreasury`); the wallet activity list omits Uniswap trades; the CSP still allows inline scripts.
