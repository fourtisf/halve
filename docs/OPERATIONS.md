# Operations runbook

Production runs on a single VPS (Hostinger, `31.97.57.242`) behind Caddy, as the pm2 process `halve`
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

## Backups

Only `data/history/` holds state (the chart samples); everything else is the git checkout and
`.env.local`. Nightly copy:

```
0 3 * * * tar czf ~/backups/halve-history-$(date +\%F).tgz -C ~/halve/halve data && find ~/backups -mtime +30 -delete
```

Keep a copy of `.env.local` in your password manager; it is the only file that cannot be rebuilt.

## Geo-blocking

The middleware redirects `/app` and `/lend` to `/restricted` when the request carries a country
header (`cf-ipcountry`, `x-vercel-ip-country`, `x-country-code`, `x-geo-country`) listed in
`BLOCKED_COUNTRIES` (default `US`). Caddy does not add one by itself: put Cloudflare in front of the
VPS (it sets `cf-ipcountry`), or install the Caddy `maxmind_geolocation` module and add
`header_up X-Country-Code {geoip.country_code}` to the `reverse_proxy` block. Without a header the
wallet-modal attestation is the only gate.

## Incident checklist

1. `curl -sS https://halve.finance/api/health | jq .` — is it the RPC (`rpc.ok=false`) or the app?
2. RPC down: nothing to do on our side; the UI shows the retry banner and merges keep working through
   any other RPC a user configures in their wallet.
3. App down: `pm2 restart halve`; if it will not start, `pm2 logs halve --err --lines 100`.
4. Certificate errors: `systemctl restart caddy`; issuance is retried automatically.
5. Wrong numbers on a live series: compare against Blockscout, then `pnpm check:live`.
