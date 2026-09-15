# Social copy: X and Threads

House rules for every post: no tickers, no yield numbers, no "guaranteed", no audit claim (there is
none yet), and "not investment advice" in every bio. The images live in `public/brand/x/` and are
regenerated with `node scripts/render-banners.mjs` (run `pnpm build` first so the site's fonts are
embedded).

## X (@Halvefinance)

**Bio** (160 max)

> Fixed yield and dividend tokens for tokenized stocks. Split a share into PT + YT, merge back free. Live on Robinhood Chain. Not investment advice.

**Website** halve.finance · **Location** Robinhood Chain

**Header** `halve-x-header-premium-1500x500.png` (upload the 3000×1000 file for retina).
Alt text: "Halve: fixed yield and dividend tokens for tokenized stocks. One share splits into one PT and one YT."

**Pinned post** with `halve-x-post-follow-1600x900.png`

> This is the official Halve account.
>
> Series launches, contract addresses and the $HALVE CA will be posted here first. There is no CA yet. Anyone DMing you one is not us.
>
> halve.finance

**Launch post** with `halve-x-post-hero-1600x900.png`

> Lock in a fixed yield on your stock tokens. Or buy the dividends outright.
>
> Halve splits a tokenized stock or ETF into two tokens: the share at a discount (PT) and every dividend it pays until a fixed date (YT). Merge them back any time, free.
>
> Live on Robinhood Chain → halve.finance

**Short lines** for reposts and replies

> One share in. Two tokens out. PT is the share at a discount, YT is every dividend until maturity. Merge back free, any time. halve.finance

> The only feed on Robinhood Chain that knows a stock split from a dividend. Free for any protocol → halve.finance/oracle

> Nothing to claim, ever. Dividends compound inside the token and pay out once, at maturity.

## Threads (@Halvefinance)

Threads has no cover image: use `halve-x-avatar-400.png` as the profile picture and let the posts
carry the visuals. Post the 4:5 files (1080×1350) in the feed; the 1:1 files are for reposts and
Instagram. Post 01 as the root and 02–04 as replies to it within a few minutes so the set reads in
order. 500 characters max per post, no hashtags needed.

**Bio** (150 max)

> Fixed yield and dividend tokens for tokenized stocks. PT is the share at a discount, YT is the dividends. On Robinhood Chain. Not investment advice.

**01 · Intro** with `halve-threads-01-intro-1080x1350.png`

> Your stock tokens pay dividends. Halve lets you sell that dividend stream, or buy someone else's.
>
> Split a tokenized stock or ETF and you get two tokens: PT, the share at a discount, and YT, every dividend it pays until a fixed date. Keep both, or keep the half you want. Merge back any time, free.
>
> Live on Robinhood Chain → halve.finance

**02 · How it works** with `halve-threads-02-how-1080x1350.png`

> How it works, in three steps.
>
> 01 Split. Deposit a stock token, get one PT and one YT per share. Fee 0.10%.
> 02 Hold or trade. PT is the share at a discount, YT is the dividend stream. Sell the half you don't want.
> 03 Merge or redeem. Merge PT + YT back into the share any time, free. Or wait for maturity: PT redeems the share, YT the dividends.
>
> That's the whole protocol.

**03 · Two ways** with `halve-threads-03-ways-1080x1350.png`

> Two ways to use Halve.
>
> Want a fixed return? Buy PT below one share, hold to maturity, redeem one full share. The discount is your yield, and you know it the day you buy.
>
> Want the dividends? Buy YT. It's a small ticket for the whole payout stream until maturity. If payouts come in higher than the market expects, YT reprices first.
>
> Both trade on Robinhood Chain. Neither needs a claim button.

**04 · Official accounts** with `halve-threads-04-official-1080x1350.png`

> Before anything launches, one rule.
>
> Series launches, contract addresses and the $HALVE contract address get posted on our official accounts first: halve.finance, X @Halvefinance and this account.
>
> There is no $HALVE CA yet. Anyone sending you one is not us. Never sign anything from a DM.

**Alt text** (one line per image)

- 01: Halve. Lock in a fixed yield on your stock tokens, or buy the dividends outright. One share splits into one PT and one YT.
- 02: How Halve works: split, hold or trade, merge or redeem.
- 03: Two ways to use Halve: PT is the share at a discount, YT is every dividend and nothing else.
- 04: Official Halve accounts: halve.finance, X @Halvefinance, Threads @Halvefinance. Nothing is real until you read it here.

If the Threads handle is not @Halvefinance, change the label in `scripts/render-banners.mjs`
(`Threads · @Halvefinance`) and re-render.

## Website series (X and Threads, 16:9 `halve-web-0N-*-1920x1080.png` or 4:5 `-1080x1350.png`)

Real screenshots of the site in a browser frame, one page per post. Re-render after mainnet so the
numbers in the screenshots are live ones (`pnpm start`, then `SITE_URL=http://127.0.0.1:3000 node scripts/render-banners.mjs`).

**01 · Introducing** (`halve-web-01-home`)

> Meet halve.finance.
>
> Fixed yield and dividend tokens for tokenized stocks, live on Robinhood Chain. Split a share into the share at a discount and every dividend it pays until a fixed date. Merge back any time, free.
>
> halve.finance

**02 · The app** (`halve-web-02-app`)

> One screen. Pick a series, read the PT price, the YT price and the dividend ledger straight from chain, then split in one transaction. Merge back is always open and always free.
>
> halve.finance/app

**03 · Dividend oracle** (`halve-web-03-oracle`)

> The feed that knows a split from a payout. One accountant per stock token classifies every corporate action by rule, on-chain. Anything ambiguous waits two days in public. Free for any protocol to read.
>
> halve.finance/oracle

**04 · Docs** (`halve-web-04-docs`)

> Read the contracts before you trust them. Lifecycle, maths, fees, addresses, the accountant rules and the HTTP API on one page. No audit yet, and the page says so.
>
> halve.finance/docs
