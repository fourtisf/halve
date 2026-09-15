#!/usr/bin/env node
/**
 * Merges deployment output into src/contracts/series.json by ticker (or id).
 *   node scripts/apply-deployment.mjs --ticker JEPI [--id JEPI-MAR27] file.json [file2.json …]
 * Each file is a flat JSON object; only known series fields are copied (underlying, vault, pt, yt,
 * accountant, poolPT, poolYT, priceFeed, quote, quoteToken, maturity, cap, decimals, deployBlock).
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const FIELDS = ['underlying', 'vault', 'pt', 'yt', 'accountant', 'poolPT', 'poolYT', 'priceFeed', 'quote', 'quoteToken', 'maturity', 'cap', 'decimals', 'deployBlock']
const args = process.argv.slice(2)
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args.splice(i, 2)[1] : undefined }
const ticker = opt('--ticker')
const id = opt('--id')
if (!ticker && !id) { console.error('usage: apply-deployment.mjs --ticker JEPI [--id JEPI-MAR27] out.json…'); process.exit(2) }

const path = resolve(new URL('../src/contracts/series.json', import.meta.url).pathname)
const series = JSON.parse(readFileSync(path, 'utf8'))
const target = series.find((s) => (id && s.id === id) || (!id && s.ticker === ticker))
if (!target) { console.error(`no series with ${id ? `id ${id}` : `ticker ${ticker}`} in series.json`); process.exit(1) }

const patch = {}
for (const f of args) Object.assign(patch, JSON.parse(readFileSync(f, 'utf8')))
const applied = []
for (const k of FIELDS) {
  if (patch[k] === undefined) continue
  target[k] = k === 'cap' ? String(patch[k]) : k === 'maturity' || k === 'decimals' || k === 'deployBlock' ? Number(patch[k]) : patch[k]
  applied.push(k)
}
writeFileSync(path, JSON.stringify(series, null, 2) + '\n')
console.log(`updated ${target.id}: ${applied.join(', ') || 'nothing'}`)
