# Operations runbook

Production runs on a single VPS (Hostinger) behind Caddy, as the pm2 process `halve`
on port 3000. This is everything needed to update it, watch it and put it back.

## Layout

| Thing | Where |
|---|---|
| Checkout | `~/halve/halve` (branch `claude/new-session-rnyba9` until merged to `main`) |
| Env | `~/halve/halve/.env.local` (never committed) |
| Process | `pm2` app `halve` → `ecosystem.config.cjs` |
| Reverse proxy | `/etc/caddy/Caddyfile`: `halve.finance { reverse_proxy 127.0.0.1:3000 }` (auto-HTTPS) |
| History samples | `~/halve/halve/data/history/*.json` (file backend) or Redis when `KV_REST_API_*` is set |
| Logs | `/var/log/halve/{out,error}.log` (pm2), `journalctl -u caddy` |

## Update

```bash
cd ~/halve/halve
git pull
pnpm install --frozen-lockfile
pnpm build
pm2 restart halve --update-env
curl -fsS https://halve.finance/api/health | jq .
```

### Live market prices

`/api/market` fetches the real share price, 30-day closes and trailing dividend yield for every ticker in
`series.json` (plus ETH-USD) from Yahoo Finance, falling back to Stooq for prices, cached one minute.
Demo series (no contracts yet) show those numbers with indicative PT / YT prices and "—" for TVL; a
live series with an empty `priceFeed` uses the quote as its USD price. `LIVE_MARKET=false` turns it off.

```bash
curl -s https://halve.finance/api/market | jq '{ok, source, updatedAt, stale, errors, spy: .quotes.SPY.price, spyYield: .quotes.SPY.trailingYield, eth: .ethUsd}'
```

`/api/health` reports the same under `market` without triggering a fetch.

pnpm settings live in `pnpm-workspace.yaml` and the pnpm version in `package.json` (`packageManager`);
a newer global pnpm hands over to that version by itself. If an install ever stops with
`ERR_PNPM_IGNORED_BUILDS`, pnpm 11 has written placeholder lines into `pnpm-workspace.yaml`:
run `git checkout -- pnpm-workspace.yaml` (or delete the file if it is untracked) and install again.

`pnpm build` runs before the restart, so a failed build leaves the old process serving. Roll back with
`git checkout <previous sha> && pnpm build && pm2 restart halve`.

## First-time setup

```bash
mkdir -p /var/log/halve
pm2 start ecosystem.config.cjs && pm2 save && pm2 startup   # follow the printed command once
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 20M
pm2 set pm2-logrotate:retain 14
pm2 set pm2-logrotate:compress true
```

## Health and monitoring

* `GET /api/health` → `{ ok, mock, rpc: { ok, block, latencyMs }, series: { live }, history: { backend, lastSample } }`.
  Returns **503** when live mode cannot reach the Robinhood Chain RPC. Point an uptime monitor
  (UptimeRobot, Better Stack, a cron + curl) at it every minute and alert on non-200.
* `pm2 logs halve --lines 200` for the app, `journalctl -u caddy -n 200` for TLS / proxy.
* Client-side crashes are POSTed to `NEXT_PUBLIC_ERROR_ENDPOINT` when set (see `src/lib/monitoring.ts`).
* Before flipping `MOCK=false`, run the mainnet preflight from the VPS: `pnpm check:live`. It checks
  the RPC, chain id, Multicall3, contract code at every address in `series.json` and every read the
  app performs.

## Sampling the YT chart

`/api/yt-history/:id` samples read-through on traffic. To keep the 30-day series dense without
traffic, add a cron on the VPS:

```
*/15 * * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://halve.finance/api/cron/sample >/dev/null
```

## Keeper and guardian

`node scripts/keeper.mjs` every 10 minutes from cron (see docs/MAINNET.md) keeps every accountant in
sync with its stock token. When the log says `held`, a change is waiting for the guardian: read it on
`/oracle`, and after the two-day timelock the guardian resolves it with `cast send <accountant> "resolvePending(uint8)" 2 --rpc-url $RPC_URL --account guardian --password-file /root/.guardian.pass` (1 = split, 2 = special dividend).

## Backups

Only `data/history/` holds state (the chart samples); everything else is the git checkout and
`.env.local`. Nightly copy:

```
0 3 * * * tar czf ~/backups/halve-history-$(date +\%F).tgz -C ~/halve/halve data && find ~/backups -mtime +30 -delete
```

Keep a copy of `.env.local` in your password manager; it is the only file that cannot be rebuilt.

## Geo-blocking

The middleware redirects `/app` and `/lend` to `/restricted` when the ONE trusted country header names a
country in `BLOCKED_COUNTRIES` (default `US`). The trusted header is `GEO_HEADER` when set, else
`x-country-code` (on Vercel, `x-vercel-ip-country`). Reading several headers would let a visitor add the
one the edge does not overwrite, so the proxy must strip every geo header a client sends before setting
its own. Caddy with the `maxmind_geolocation` module:

```
halve.finance {
  reverse_proxy 127.0.0.1:3000 {
    header_up -X-Country-Code
    header_up -X-Vercel-IP-Country
    header_up -CF-IPCountry
    header_up -X-Geo-Country
    header_up X-Country-Code {geoip.country_code}
  }
}
```

With Cloudflare in front instead, set `GEO_HEADER=cf-ipcountry` and allow only Cloudflare's IP ranges to
reach the origin, otherwise a direct connection carries no header. `GEO_REQUIRED=1` sends requests without
a usable header to `/restricted` as well; use it once the header is known to be set. Without a header the
wallet-modal attestation is the only gate.

## Incident checklist

1. `curl -sS https://halve.finance/api/health | jq .` — is it the RPC (`rpc.ok=false`) or the app?
2. RPC down: nothing to do on our side; the UI shows the retry banner and merges keep working through
   any other RPC a user configures in their wallet.
3. App down: `pm2 restart halve`; if it will not start, `pm2 logs halve --err --lines 100`.
4. Certificate errors: `systemctl restart caddy`; issuance is retried automatically.
5. Wrong numbers on a live series: compare against Blockscout, then `pnpm check:live`.
