#!/usr/bin/env node
/**
 * Renders the X banners from HTML with the site's own tokens (black, Inter, Geist Mono, gold #E8C170,
 * the Stack mark) so they match halve.finance exactly. Output: public/brand/x/.
 *   node scripts/render-banners.mjs
 */
import { chromium } from '@playwright/test'
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(new URL('..', import.meta.url).pathname)
const out = resolve(root, 'public/brand/x')
mkdirSync(out, { recursive: true })

/**
 * The exact font files the site ships: next/font writes @font-face rules into .next/static/css and the
 * woff2 files into .next/static/media. Embedding them as data: URIs keeps the render offline and pixel-true.
 * Falls back to Google Fonts when there is no build yet (`pnpm build` first for a faithful render).
 */
function fontCss() {
  const staticDir = resolve(root, '.next/static')
  if (!existsSync(staticDir)) return `<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet">`
  const cssFiles = readdirSync(staticDir, { recursive: true }).map(String).filter((f) => f.endsWith('.css'))
  const faces = []
  for (const f of cssFiles) {
    const css = readFileSync(resolve(staticDir, f), 'utf8')
    for (const m of css.matchAll(/@font-face\{([^}]*)\}/g)) {
      const block = m[1]
      const family = /font-family:\s*['"]?([^;'"]+)['"]?/.exec(block)?.[1]?.trim()
      const url = /url\(([^)]+\.woff2)\)/.exec(block)?.[1]
      if (!family || !url || family.endsWith('Fallback')) continue
      const file = url.startsWith('/_next/') ? resolve(root, '.next', url.slice('/_next/'.length)) : resolve(staticDir, f, '..', url)
      if (!existsSync(file)) continue
      const b64 = readFileSync(file).toString('base64')
      const weight = /font-weight:\s*([^;]+)/.exec(block)?.[1] ?? '400'
      const style = /font-style:\s*([^;]+)/.exec(block)?.[1] ?? 'normal'
      const range = /unicode-range:\s*([^;]+)/.exec(block)?.[1]
      faces.push(`@font-face{font-family:'${family}';font-weight:${weight};font-style:${style};${range ? `unicode-range:${range};` : ''}src:url(data:font/woff2;base64,${b64}) format('woff2')}`)
    }
  }
  console.log(`embedded ${faces.length} font face(s) from the build`)
  return `<style>${faces.join('\n')}</style>`
}

const MARK = (s, ink = '#FAFAFA', gold = '#E8C170') => `<svg width="${s}" height="${s}" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" style="display:block;flex-shrink:0"><rect x="8" y="44" width="48" height="10" rx="3" fill="${ink}"/><rect x="8" y="30" width="48" height="10" rx="3" fill="${ink}"/><rect x="14" y="10" width="48" height="10" rx="3" fill="${gold}"/></svg>`
const XGLYPH = (s, c = '#FAFAFA') => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="display:block"><path fill="${c}" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`

const BASE = `
${fontCss()}
<style>
:root{--bg:#000;--bg1:#0A0A0A;--bg2:#121212;--fg:#FAFAFA;--fg2:#A1A1A1;--fg3:#6B6B6B;--line:#1F1F1F;--line2:#2E2E2E;--yt:#E8C170;--green:#3DD68C}
*{box-sizing:border-box;margin:0;padding:0}
body{background:#000;color:var(--fg);font-family:Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased;font-feature-settings:"cv11","ss01";line-height:1.5}
.mono{font-family:'Geist Mono',ui-monospace,monospace;font-variant-numeric:tabular-nums}
.frame{position:relative;overflow:hidden;background:#000}
.glow{position:absolute;border-radius:50%;pointer-events:none}
.lockup{position:absolute;display:flex;align-items:center;gap:10px;font-weight:600;letter-spacing:-.02em}
.eyebrow{display:inline-flex;align-items:center;gap:9px;color:var(--fg2);border:1px solid var(--line2);border-radius:99px;background:var(--bg1)}
.eyebrow i{width:7px;height:7px;border-radius:50%;background:var(--green);box-shadow:0 0 9px var(--green)}
.eyebrow i.y{background:var(--yt);box-shadow:0 0 9px var(--yt)}
h1{font-weight:500;letter-spacing:-.045em;line-height:1.02;background:linear-gradient(180deg,#fff 40%,#8A8A8A);-webkit-background-clip:text;background-clip:text;color:transparent}
p{color:var(--fg2);line-height:1.55}
.chip{border:1px solid var(--line2);background:var(--bg1);border-radius:14px;display:flex;flex-direction:column;justify-content:center;gap:2px}
.chip small{font-family:'Geist Mono',ui-monospace,monospace;color:var(--fg3)}
.chip b{font-weight:500;letter-spacing:-.03em;color:var(--fg)}
.chip.y b{color:var(--yt)}
.chip.y{border-color:rgba(232,193,112,.35);box-shadow:0 0 40px rgba(232,193,112,.08)}
.arrow{color:var(--fg3);display:flex;align-items:center;justify-content:center}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;font-weight:500;border:1px solid transparent;border-radius:12px;white-space:nowrap}
.btn-white{background:var(--fg);color:#000}.btn-line{border-color:var(--line2);color:var(--fg)}
.foot{position:absolute;color:var(--fg3)}
.dots{position:absolute;inset:0;background-image:radial-gradient(rgba(255,255,255,.09) 1px,transparent 1.3px);background-size:26px 26px;-webkit-mask-image:radial-gradient(closest-side at var(--mx,55%) var(--my,45%),#000 10%,transparent 100%);mask-image:radial-gradient(closest-side at var(--mx,55%) var(--my,45%),#000 10%,transparent 100%)}
.sweep{position:absolute;inset:0;background:linear-gradient(112deg,transparent 40%,rgba(255,255,255,.045) 50%,transparent 60%)}
.hair{position:absolute;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.16) 30%,rgba(255,255,255,.16) 70%,transparent)}
.vhair{position:absolute;top:0;bottom:0;width:1px;background:linear-gradient(180deg,transparent,rgba(255,255,255,.12),transparent)}
.glass{position:relative;border:1px solid transparent;border-radius:18px;background:linear-gradient(#0B0B0B,#0B0B0B) padding-box,linear-gradient(135deg,rgba(232,193,112,.6),rgba(255,255,255,.10) 40%,rgba(255,255,255,.05)) border-box;box-shadow:0 40px 90px rgba(0,0,0,.65),inset 0 1px 0 rgba(255,255,255,.05)}
.glass.gold{background:linear-gradient(#0B0B0B,#0B0B0B) padding-box,linear-gradient(135deg,rgba(232,193,112,.95),rgba(232,193,112,.3) 45%,rgba(232,193,112,.12)) border-box;box-shadow:0 40px 90px rgba(0,0,0,.65),0 0 70px rgba(232,193,112,.13)}
.kicker{font-family:'Geist Mono',ui-monospace,monospace;font-size:12.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--yt)}
.row{display:flex;justify-content:space-between;align-items:center;padding:14px 0;border-top:1px solid rgba(255,255,255,.07)}
.row small{font-family:'Geist Mono',ui-monospace,monospace;font-size:12px;color:var(--fg3);letter-spacing:.02em}
.row b{font-family:'Geist Mono',ui-monospace,monospace;font-weight:500;font-size:20px;letter-spacing:-.01em;font-variant-numeric:tabular-nums}
.grain{position:absolute;inset:0;opacity:.07;mix-blend-mode:screen;pointer-events:none}
</style>`

/** 1 share → 1 PT + 1 YT, the product in one glance. */
const splitVisual = (scale = 1) => {
  const w = 168 * scale, h = 72 * scale, gap = 14 * scale
  const chip = (cls, k, v) => `<div class="chip ${cls}" style="width:${w}px;height:${h}px;padding:0 ${18 * scale}px"><small style="font-size:${11 * scale}px">${k}</small><b style="font-size:${22 * scale}px">${v}</b></div>`
  return `<div style="display:flex;align-items:center;gap:${gap}px">
    ${chip('', 'stock token', '1 share')}
    <div class="arrow" style="width:${28 * scale}px;font-size:${22 * scale}px">→</div>
    <div style="display:flex;flex-direction:column;gap:${gap}px">${chip('', 'principal · PT', '1 PT')}${chip('y', 'yield · YT', '1 YT')}</div>
  </div>`
}

const header = `${BASE}
<div class="frame" style="width:1500px;height:500px">
  <div class="glow" style="left:-120px;top:-260px;width:1100px;height:900px;background:radial-gradient(closest-side,rgba(232,193,112,.11),transparent)"></div>
  <div class="glow" style="right:-200px;top:-100px;width:700px;height:700px;background:radial-gradient(closest-side,rgba(255,255,255,.04),transparent)"></div>
  <div class="lockup" style="left:72px;top:52px;font-size:22px">${MARK(28)}Halve</div>
  <div class="mono foot" style="right:72px;top:58px;font-size:13px">halve.finance · @Halvefinance</div>
  <div style="position:absolute;left:72px;top:142px;width:820px">
    <div class="eyebrow" style="font-size:13px;padding:6px 13px"><i></i>Live on Robinhood Chain</div>
    <h1 style="font-size:56px;margin:18px 0 16px;white-space:nowrap">Fixed yield and dividend<br>tokens for tokenized stocks.</h1>
    <p style="font-size:19px;max-width:640px">Split a share into the share at a discount and every dividend it pays until a fixed date. Merge back any time, for free.</p>
  </div>
  <div style="position:absolute;right:72px;top:170px">${splitVisual(1.06)}</div>
</div>`

const follow = `${BASE}
<div class="frame" style="width:1600px;height:900px">
  <div class="glow" style="left:-160px;top:-300px;width:1200px;height:1000px;background:radial-gradient(closest-side,rgba(232,193,112,.10),transparent)"></div>
  <div class="lockup" style="left:96px;top:80px;font-size:24px">${MARK(30)}Halve</div>
  <div class="mono foot" style="right:96px;top:88px;font-size:14px">halve.finance</div>
  <div style="position:absolute;left:96px;top:250px;width:900px">
    <div class="eyebrow" style="font-size:14px;padding:7px 14px"><i class="y"></i>Now on X</div>
    <h1 style="font-size:84px;margin:26px 0 22px">Follow @Halvefinance</h1>
    <p style="font-size:24px;max-width:760px">Series launches, contract addresses and the $HALVE contract address are announced there first. Nothing is real until you read it on that account.</p>
    <div style="display:flex;gap:12px;margin-top:38px">
      <div class="btn btn-white" style="height:56px;padding:0 26px;font-size:18px">${XGLYPH(18, '#000')}x.com/Halvefinance</div>
      <div class="btn btn-line" style="height:56px;padding:0 26px;font-size:18px">halve.finance</div>
    </div>
  </div>
  <div style="position:absolute;right:96px;top:230px;width:400px;height:400px;border:1px solid var(--line);border-radius:32px;background:var(--bg1);display:flex;align-items:center;justify-content:center;box-shadow:0 0 120px rgba(232,193,112,.10)">
    <div class="glow" style="left:50%;top:50%;width:420px;height:420px;transform:translate(-50%,-50%);background:radial-gradient(closest-side,rgba(232,193,112,.14),transparent)"></div>
    ${XGLYPH(176)}
  </div>
  <div class="mono foot" style="right:96px;top:660px;width:400px;text-align:center;font-size:14px">@Halvefinance</div>
  <div class="mono foot" style="left:96px;bottom:72px;font-size:14px">halve.finance · @Halvefinance</div>
  <div class="mono foot" style="right:96px;bottom:72px;font-size:14px">Live on Robinhood Chain · 4663</div>
</div>`

const web = `${BASE}
<div class="frame" style="width:1600px;height:900px">
  <div class="glow" style="left:50%;top:-200px;width:1200px;height:900px;transform:translateX(-50%);background:radial-gradient(closest-side,rgba(232,193,112,.10),transparent)"></div>
  <div class="lockup" style="left:50%;top:104px;transform:translateX(-50%);font-size:24px">${MARK(30)}Halve</div>
  <div style="position:absolute;left:0;right:0;top:214px;text-align:center">
    <div class="eyebrow" style="font-size:14px;padding:7px 14px"><i></i>Live on Robinhood Chain</div>
    <h1 style="font-size:80px;margin:26px auto 22px;max-width:1100px">Lock in a fixed yield on your stock tokens. Or buy the dividends outright.</h1>
    <p style="font-size:24px;max-width:780px;margin:0 auto">One share in, the share and its dividends out, as two tokens you can hold, trade or merge back for free.</p>
  </div>
  <div style="position:absolute;left:50%;top:640px;transform:translateX(-50%)">${splitVisual(1.05)}</div>
  <div class="mono foot" style="left:0;right:0;bottom:40px;text-align:center;font-size:14px">halve.finance · @Halvefinance</div>
</div>`


/**
 * Threads / Instagram posts. Threads has no cover image: the profile picture is the avatar in
 * public/brand, and posts carry the visuals. 4:5 (1080×1350) gets the most feed space; 1:1 for reuse.
 * Same premium layers as the X headers: dot grid, light sweep, grain, glass panels, a faint watermark.
 */
const card = (w, h, kicker, body, s = 1) => `${BASE}
<div class="frame" style="width:${w}px;height:${h}px;display:flex;flex-direction:column;padding:${68 * s}px ${80 * s}px ${56 * s}px">
  <div class="glow" style="left:-260px;top:-360px;width:1100px;height:1000px;background:radial-gradient(closest-side,rgba(232,193,112,.13),transparent 70%)"></div>
  <div class="glow" style="right:-300px;bottom:-380px;width:900px;height:900px;background:radial-gradient(closest-side,rgba(232,193,112,.09),transparent 70%)"></div>
  <div class="dots" style="--mx:50%;--my:38%"></div>
  <div class="sweep"></div>
  <div style="position:absolute;right:${80 * s}px;bottom:${118 * s}px;opacity:.07">${MARK(200 * s)}</div>
  <div style="display:flex;justify-content:space-between;align-items:center;position:relative;padding-bottom:${26 * s}px;border-bottom:1px solid rgba(255,255,255,.09)">
    <div class="lockup" style="position:static;font-size:${26 * s}px">${MARK(32 * s)}Halve</div>
    <div class="mono" style="font-size:${13 * s}px;letter-spacing:.18em;color:var(--fg3)">${kicker}</div>
  </div>
  <div style="flex:1;display:flex;flex-direction:column;justify-content:center;position:relative;min-height:0">${body}</div>
  <div class="mono" style="display:flex;justify-content:space-between;font-size:${12.5 * s}px;letter-spacing:.14em;color:var(--fg3);position:relative;padding-top:${24 * s}px;border-top:1px solid rgba(255,255,255,.09)"><span>HALVE.FINANCE · @HALVEFINANCE</span><span>ROBINHOOD CHAIN · 4663</span></div>
  ${GRAIN}
</div>`

const trow = (k, v, s, opts = {}) => `<div class="row" style="padding:${15 * s}px 0;${opts.first ? 'border-top:0;padding-top:0;' : ''}${opts.last ? `padding-bottom:0;` : ''}"><small style="font-size:${12.5 * s}px">${k}</small><b style="font-size:${22 * s}px;${opts.gold ? 'color:var(--yt);' : ''}">${v}</b></div>`
const ticket = (s) => `<div class="glass" style="padding:${24 * s}px ${28 * s}px ${22 * s}px;border-radius:${20 * s}px">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:${12 * s}px">
    <div style="font-size:${17 * s}px;font-weight:500">Split</div>
    <div class="mono" style="font-size:${12 * s}px;color:var(--fg3);display:flex;align-items:center;gap:${7 * s}px"><i style="width:${6 * s}px;height:${6 * s}px;border-radius:50%;background:var(--green);box-shadow:0 0 8px var(--green);display:inline-block"></i>accountant synced</div>
  </div>
  ${trow('YOU DEPOSIT', `1.0000 <span style="color:var(--fg3);font-weight:400">share</span>`, s, { first: true })}
  ${trow('YOU RECEIVE', `1.0000 <span style="color:var(--fg3);font-weight:400">PT</span>`, s)}
  ${trow('&nbsp;', `1.0000 <span style="color:var(--fg3);font-weight:400">YT</span>`, s, { gold: true })}
  ${trow('FEE · MERGE', `<span style="font-size:${13 * s}px;font-weight:400;color:var(--fg2)">0.10 % · free, any time</span>`, s, { last: true })}
  <div style="position:absolute;left:0;right:0;bottom:-1px;height:1px;background:linear-gradient(90deg,transparent,rgba(232,193,112,.7),transparent)"></div>
</div>`

const step = (n, t, d, s, last = false) => `<div style="display:flex;gap:${24 * s}px;padding:${22 * s}px 0;${last ? '' : 'border-bottom:1px solid rgba(255,255,255,.08);'}">
  <div class="mono" style="color:var(--yt);font-size:${14 * s}px;letter-spacing:.1em;padding-top:${7 * s}px;width:${34 * s}px;flex-shrink:0">${n}</div>
  <div><div style="font-size:${26 * s}px;font-weight:500;letter-spacing:-.02em">${t}</div><div style="font-size:${18.5 * s}px;color:var(--fg2);margin-top:${6 * s}px;line-height:1.5">${d}</div></div>
</div>`

const way = (gold, k, t, d, s) => `<div class="glass${gold ? ' gold' : ''}" style="padding:${30 * s}px ${34 * s}px;border-radius:${22 * s}px">
  <div style="display:flex;justify-content:space-between;align-items:center"><div class="mono" style="font-size:${12.5 * s}px;letter-spacing:.16em;color:${gold ? 'var(--yt)' : 'var(--fg3)'}">${k}</div><div class="mono" style="font-size:${40 * s}px;font-weight:500;letter-spacing:-.04em;color:${gold ? 'rgba(232,193,112,.22)' : 'rgba(255,255,255,.12)'};line-height:1">${gold ? 'YT' : 'PT'}</div></div>
  <div style="font-size:${34 * s}px;font-weight:500;letter-spacing:-.03em;margin-top:${6 * s}px;${gold ? 'color:var(--yt);' : ''}">${t}</div>
  <div style="font-size:${18.5 * s}px;color:var(--fg2);line-height:1.5;margin-top:${10 * s}px">${d}</div>
</div>`

const acct = (icon, k, v, s, last = false) => `<div style="display:flex;align-items:center;gap:${18 * s}px;padding:${18 * s}px 0;${last ? '' : 'border-bottom:1px solid rgba(255,255,255,.08);'}">
  <div style="width:${40 * s}px;height:${40 * s}px;border-radius:${11 * s}px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.03);display:flex;align-items:center;justify-content:center;font-size:${17 * s}px;color:var(--fg)">${icon}</div>
  <div class="mono" style="font-size:${12.5 * s}px;letter-spacing:.14em;color:var(--fg3);width:${110 * s}px">${k}</div>
  <div class="mono" style="font-size:${20 * s}px;font-weight:500">${v}</div>
</div>`

function threadsBody(variant, s) {
  const kicker = (txt) => `<div class="kicker" style="font-size:${13 * s}px">${txt}</div>`
  const h1 = (txt, size) => `<h1 style="font-size:${size * s}px;margin:${22 * s}px 0 ${20 * s}px">${txt}</h1>`
  const p = (txt) => `<p style="font-size:${23 * s}px;max-width:${820 * s}px;color:#9A9A9A">${txt}</p>`
  switch (variant) {
    case 'intro':
      return `${kicker('Fixed yield · Dividend tokens · Robinhood Chain')}${h1('Lock in a fixed yield on your stock tokens. Or buy the dividends outright.', 72)}${p('Halve splits a tokenized stock or ETF into two things you can own separately: the share at a discount, and every dividend it pays until a fixed date.')}<div style="margin-top:${44 * s}px">${ticket(s)}</div>`
    case 'how':
      return `${kicker('How it works')}${h1('One share in.<br>Two tokens out.', 84)}<div class="glass" style="padding:${8 * s}px ${32 * s}px;border-radius:${22 * s}px;margin-top:${14 * s}px">${step('01', 'Split', 'Deposit a stock token. You get a principal token (PT) and a yield token (YT), one each per share. Fee 0.10 %.', s)}${step('02', 'Hold or trade', 'PT is the share at a discount, YT is the dividend stream. Keep both, or sell the half you don’t want.', s)}${step('03', 'Merge or redeem', 'Merge PT + YT back into the share any time, free. Or wait for maturity: PT redeems the share, YT the dividends.', s, true)}</div>`
    case 'ways':
      return `${kicker('Two ways to use it')}${h1('Pick the half you want.', 84)}<div style="display:flex;flex-direction:column;gap:${18 * s}px;margin-top:${12 * s}px">${way(false, 'PRINCIPAL TOKEN', 'The share at a discount.', 'Buy PT below one share, hold to maturity, redeem one full share. The discount is your fixed yield, known the day you buy.', s)}${way(true, 'YIELD TOKEN', 'Every dividend, nothing else.', 'A small ticket for the whole payout stream until maturity. If the payouts come in higher than the market expects, YT reprices first.', s)}</div>`
    case 'official':
      return `${kicker('Official accounts')}${h1('Nothing is real until you read it here.', 84)}${p('Series launches, contract addresses and the $HALVE contract address are posted on our official accounts first. Anyone else sending you a contract address is not us.')}<div class="glass" style="padding:${6 * s}px ${30 * s}px;border-radius:${22 * s}px;margin-top:${40 * s}px">${acct('↗', 'WEBSITE', 'halve.finance', s)}${acct(XGLYPH(16 * s), 'X', '@Halvefinance', s)}${acct('@', 'THREADS', '@Halvefinance', s)}${acct(`<i style="width:${8 * s}px;height:${8 * s}px;border-radius:50%;background:var(--yt);box-shadow:0 0 10px var(--yt);display:inline-block"></i>`, '$HALVE CA', `<span style="color:var(--yt)">not published yet</span>`, s, true)}</div>`
    default:
      throw new Error(variant)
  }
}

/** Threads landscape (16:9, 1920×1080): same four designs as a wide banner, text left, panel right. */
const wideCard = (kicker, left, right) => `${BASE}
<div class="frame" style="width:1920px;height:1080px;display:flex;flex-direction:column;padding:72px 96px 60px">
  <div class="glow" style="left:-300px;top:-420px;width:1300px;height:1100px;background:radial-gradient(closest-side,rgba(232,193,112,.13),transparent 70%)"></div>
  <div class="glow" style="right:-260px;bottom:-460px;width:1100px;height:1000px;background:radial-gradient(closest-side,rgba(232,193,112,.12),transparent 70%)"></div>
  <div class="dots" style="--mx:68%;--my:50%"></div>
  <div class="sweep"></div>
  <div style="display:flex;justify-content:space-between;align-items:center;position:relative;padding-bottom:26px;border-bottom:1px solid rgba(255,255,255,.09)">
    <div class="lockup" style="position:static;font-size:26px">${MARK(32)}Halve</div>
    <div class="mono" style="font-size:13px;letter-spacing:.18em;color:var(--fg3)">${kicker}</div>
  </div>
  <div style="flex:1;display:grid;grid-template-columns:1fr 1fr;gap:96px;align-items:center;position:relative;min-height:0">
    <div>${left}</div>
    <div>${right}</div>
  </div>
  <div class="mono" style="display:flex;justify-content:space-between;font-size:12.5px;letter-spacing:.14em;color:var(--fg3);position:relative;padding-top:24px;border-top:1px solid rgba(255,255,255,.09)"><span>HALVE.FINANCE · @HALVEFINANCE</span><span>ROBINHOOD CHAIN · 4663</span></div>
  ${GRAIN}
</div>`

function threadsWide(variant) {
  const kicker = (txt) => `<div class="kicker">${txt}</div>`
  const h1 = (txt, size = 76) => `<h1 style="font-size:${size}px;margin:22px 0 20px">${txt}</h1>`
  const p = (txt) => `<p style="font-size:24px;max-width:760px;color:#9A9A9A">${txt}</p>`
  switch (variant) {
    case 'intro':
      return wideCard('01 / 04', `${kicker('Fixed yield · Dividend tokens · Robinhood Chain')}${h1('Lock in a fixed yield on your stock tokens. Or buy the dividends outright.', 72)}${p('Halve splits a tokenized stock or ETF into two things you can own separately: the share at a discount, and every dividend it pays until a fixed date.')}`, ticket(1.12))
    case 'how':
      return wideCard('02 / 04', `${kicker('How it works')}${h1('One share in.<br>Two tokens out.', 92)}${p('Three steps, no claim button, nothing to manage in between.')}`, `<div class="glass" style="padding:10px 34px;border-radius:24px">${step('01', 'Split', 'Deposit a stock token. You get a principal token (PT) and a yield token (YT), one each per share. Fee 0.10 %.', 1)}${step('02', 'Hold or trade', 'PT is the share at a discount, YT is the dividend stream. Keep both, or sell the half you don’t want.', 1)}${step('03', 'Merge or redeem', 'Merge PT + YT back into the share any time, free. Or wait for maturity: PT redeems the share, YT the dividends.', 1, true)}</div>`)
    case 'ways':
      return wideCard('03 / 04', `${kicker('Two ways to use it')}${h1('Pick the half you want.', 92)}${p('Splitting gives you both tokens. Keep the one you want and sell the other on Robinhood Chain.')}`, `<div style="display:flex;flex-direction:column;gap:20px">${way(false, 'PRINCIPAL TOKEN', 'The share at a discount.', 'Buy PT below one share, hold to maturity, redeem one full share. The discount is your fixed yield, known the day you buy.', 1)}${way(true, 'YIELD TOKEN', 'Every dividend, nothing else.', 'A small ticket for the whole payout stream until maturity. If the payouts come in higher than the market expects, YT reprices first.', 1)}</div>`)
    case 'official':
      return wideCard('04 / 04', `${kicker('Official accounts')}${h1('Nothing is real until you read it here.', 84)}${p('Series launches, contract addresses and the $HALVE contract address are posted on our official accounts first. Anyone else sending you a contract address is not us.')}`, `<div class="glass" style="padding:8px 34px;border-radius:24px">${acct('↗', 'WEBSITE', 'halve.finance', 1.1)}${acct(XGLYPH(18), 'X', '@Halvefinance', 1.1)}${acct('@', 'THREADS', '@Halvefinance', 1.1)}${acct(`<i style="width:9px;height:9px;border-radius:50%;background:var(--yt);box-shadow:0 0 10px var(--yt);display:inline-block"></i>`, '$HALVE CA', `<span style="color:var(--yt)">not published yet</span>`, 1.1, true)}</div>`)
    default:
      throw new Error(variant)
  }
}

const threadsJob = (variant, n) => [
  { name: `halve-threads-0${n}-${variant}-1080x1350.png`, html: card(1080, 1350, `0${n} / 04`, threadsBody(variant, 1), 1), w: 1080, h: 1350, scale: 1 },
  { name: `halve-threads-0${n}-${variant}-1080x1080.png`, html: card(1080, 1080, `0${n} / 04`, threadsBody(variant, 0.82), 0.82), w: 1080, h: 1080, scale: 1 },
  { name: `halve-threads-0${n}-${variant}-1920x1080.png`, html: threadsWide(variant), w: 1920, h: 1080, scale: 1 },
]


/** Film grain: an SVG turbulence layer at low opacity keeps big black areas from banding. */
const GRAIN = `<svg class="grain" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"><filter id="g"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter><rect width="100%" height="100%" filter="url(#g)"/></svg>`
const TOPBAR = `<div class="lockup" style="left:72px;top:52px;font-size:22px">${MARK(28)}Halve</div><div class="mono foot" style="right:72px;top:57px;font-size:12.5px;letter-spacing:.08em">HALVE.FINANCE · @HALVEFINANCE</div>`

/** A. Monument: the mark at architectural scale, one line of type. */
const headerA = `${BASE}
<div class="frame" style="width:1500px;height:500px">
  <div class="glow" style="right:-260px;top:-360px;width:1200px;height:1200px;background:radial-gradient(closest-side,rgba(232,193,112,.17),transparent 72%)"></div>
  <div class="dots" style="--mx:72%;--my:50%"></div>
  <div class="sweep"></div>
  <div style="position:absolute;right:120px;top:50%;transform:translateY(-46%);filter:drop-shadow(0 0 70px rgba(232,193,112,.28))">${MARK(400)}</div>
  <div class="vhair" style="right:600px;top:60px;bottom:60px"></div>
  ${TOPBAR}
  <div style="position:absolute;left:72px;top:148px;width:760px">
    <div class="kicker">Fixed yield · Dividend tokens · Robinhood Chain</div>
    <h1 style="font-size:68px;margin:20px 0 18px;letter-spacing:-.05em">Own the share.<br>Or own the dividends.</h1>
    <p style="font-size:19px;max-width:560px;color:#8E8E8E">One stock token in, two tokens out.<br>Merge back any time, free.</p>
  </div>
  ${GRAIN}
</div>`

/** B. Glass: the split ticket as a floating panel, product-true, no yield numbers. */
const headerB = `${BASE}
<div class="frame" style="width:1500px;height:500px">
  <div class="glow" style="left:-200px;top:-320px;width:1100px;height:1000px;background:radial-gradient(closest-side,rgba(232,193,112,.12),transparent 70%)"></div>
  <div class="glow" style="right:-120px;bottom:-420px;width:900px;height:800px;background:radial-gradient(closest-side,rgba(232,193,112,.14),transparent 70%)"></div>
  <div class="dots" style="--mx:78%;--my:55%"></div>
  <div class="sweep"></div>
  ${TOPBAR}
  <div style="position:absolute;left:72px;top:158px;width:760px">
    <div class="kicker">Live on Robinhood Chain</div>
    <h1 style="font-size:60px;margin:20px 0 16px;white-space:nowrap">Fixed yield and dividend<br>tokens for tokenized stocks.</h1>
    <p style="font-size:18px;max-width:600px;color:#8E8E8E">The share at a discount, and every dividend it pays until a fixed date. As two tokens.</p>
  </div>
  <div class="glass" style="position:absolute;right:92px;top:96px;width:470px;padding:22px 26px 18px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <div style="font-size:15px;font-weight:500;letter-spacing:-.01em">Split</div>
      <div class="mono" style="font-size:11.5px;color:var(--fg3);display:flex;align-items:center;gap:7px"><i style="width:6px;height:6px;border-radius:50%;background:var(--green);box-shadow:0 0 8px var(--green);display:inline-block"></i>accountant synced</div>
    </div>
    <div class="row" style="border-top:0;padding-top:6px"><small>YOU DEPOSIT</small><b>1.0000 <span style="color:var(--fg3);font-weight:400">share</span></b></div>
    <div class="row"><small>YOU RECEIVE</small><b>1.0000 <span style="color:var(--fg3);font-weight:400">PT</span></b></div>
    <div class="row"><small>&nbsp;</small><b style="color:var(--yt)">1.0000 <span style="color:var(--fg3);font-weight:400">YT</span></b></div>
    <div class="row" style="padding-bottom:4px"><small>FEE · MERGE</small><small style="color:var(--fg2)">0.10 % · free, any time</small></div>
    <div style="position:absolute;left:0;right:0;bottom:-1px;height:1px;background:linear-gradient(90deg,transparent,rgba(232,193,112,.7),transparent)"></div>
  </div>
  ${GRAIN}
</div>`

/** C. Editorial: centred lockup, gold rule, hairlines. Reads like a masthead. */
const headerC = `${BASE}
<div class="frame" style="width:1500px;height:500px">
  <div class="glow" style="left:50%;top:-380px;width:1300px;height:1000px;transform:translateX(-50%);background:radial-gradient(closest-side,rgba(232,193,112,.13),transparent 70%)"></div>
  <div class="dots" style="--mx:50%;--my:40%"></div>
  <div class="hair" style="top:64px"></div>
  <div class="hair" style="bottom:64px"></div>
  <div class="mono foot" style="left:72px;top:40px;font-size:12px;letter-spacing:.14em">ROBINHOOD CHAIN · 4663</div>
  <div class="mono foot" style="right:72px;top:40px;font-size:12px;letter-spacing:.14em">HALVE.FINANCE</div>
  <div style="position:absolute;left:0;right:0;top:118px;display:flex;flex-direction:column;align-items:center">
    <div style="display:flex;align-items:center;gap:22px;font-size:76px;font-weight:600;letter-spacing:-.045em;line-height:1;filter:drop-shadow(0 0 50px rgba(232,193,112,.16))">${MARK(84)}Halve</div>
    <div style="width:44px;height:2px;background:var(--yt);margin:30px 0 26px;box-shadow:0 0 18px rgba(232,193,112,.6)"></div>
    <div style="font-size:24px;color:#B4B4B4;letter-spacing:-.015em">Fixed yield and dividend tokens for tokenized stocks.</div>
    <div class="mono" style="font-size:12.5px;letter-spacing:.2em;color:var(--fg3);margin-top:26px">SPLIT &nbsp;·&nbsp; HOLD &nbsp;·&nbsp; MERGE</div>
  </div>
  <div class="mono foot" style="left:0;right:0;bottom:40px;text-align:center;font-size:12px;letter-spacing:.14em">@HALVEFINANCE</div>
  ${GRAIN}
</div>`

const jobs = [
  { name: 'halve-x-header-premium-1500x500.png', html: header, w: 1500, h: 500, scale: 1 },
  { name: 'halve-x-header-premium-3000x1000.png', html: header, w: 1500, h: 500, scale: 2 },
  { name: 'halve-x-header-a-monument-1500x500.png', html: headerA, w: 1500, h: 500, scale: 1 },
  { name: 'halve-x-header-a-monument-3000x1000.png', html: headerA, w: 1500, h: 500, scale: 2 },
  { name: 'halve-x-header-b-glass-1500x500.png', html: headerB, w: 1500, h: 500, scale: 1 },
  { name: 'halve-x-header-b-glass-3000x1000.png', html: headerB, w: 1500, h: 500, scale: 2 },
  { name: 'halve-x-header-c-editorial-1500x500.png', html: headerC, w: 1500, h: 500, scale: 1 },
  { name: 'halve-x-header-c-editorial-3000x1000.png', html: headerC, w: 1500, h: 500, scale: 2 },
  { name: 'halve-x-post-follow-1600x900.png', html: follow, w: 1600, h: 900, scale: 1 },
  { name: 'halve-x-post-hero-1600x900.png', html: web, w: 1600, h: 900, scale: 1 },
  ...threadsJob('intro', 1),
  ...threadsJob('how', 2),
  ...threadsJob('ways', 3),
  ...threadsJob('official', 4),
]

const browser = await chromium.launch()
for (const j of jobs) {
  const page = await browser.newPage({ viewport: { width: j.w, height: j.h }, deviceScaleFactor: j.scale })
  await page.setContent(j.html, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(200)
  await page.screenshot({ path: resolve(out, j.name), clip: { x: 0, y: 0, width: j.w, height: j.h } })
  await page.close()
  console.log('wrote', j.name)
}
await browser.close()
