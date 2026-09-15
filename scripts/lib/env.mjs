/**
 * Reads a KEY=value env file the way an operator expects: quotes stripped, inline `# comments` dropped from
 * unquoted values, a leading `~` expanded to the home directory (also inside space-separated values such as
 * WALLET_ARGS), and an empty value treated as unset so `??` defaults apply. The process environment wins.
 */
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'

/** Parse env-file text into { KEY: value } (no process env merged). Exported for tests. */
export function parseEnv(text, home = homedir()) {
  const out = {}
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\r$/, '')
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/.exec(line)
    if (!m) continue
    let v = m[2].trim()
    const q = /^(["'])(.*)\1\s*(?:#.*)?$/.exec(v)
    if (q) v = q[2]
    else v = v.replace(/\s+#.*$/, '').replace(/^#.*$/, '').trim()
    v = v.replace(/(^|\s)~(?=\/|\s|$)/g, `$1${home}`)
    if (v !== '') out[m[1]] = v
  }
  return out
}

/** The env file merged under the process environment; `file` defaults to .env.mainnet next to the repo root. */
export function loadEnv(file) {
  const env = {}
  if (file && existsSync(file)) Object.assign(env, parseEnv(readFileSync(file, 'utf8')))
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined && v !== '') env[k] = v
  return env
}

/** Signing arguments for forge / cast from the env: a keystore (WALLET_ARGS) or a raw key. */
export function walletArgsFrom(env) {
  if (env.DEPLOYER_KEY) return ['--private-key', env.DEPLOYER_KEY]
  if (env.WALLET_ARGS) return env.WALLET_ARGS.split(/\s+/).filter(Boolean)
  return null
}

export const isLocalRpc = (rpc) => /^(https?:\/\/)?(127\.0\.0\.1|localhost|0\.0\.0\.0|\[::1\])(:|\/|$)/.test(rpc ?? '')

/** Refuse a plaintext key against a remote chain: `--private-key` shows it to every process on the host. */
export function refusePlaintextKey(env, rpc) {
  if (env.DEPLOYER_KEY && !isLocalRpc(rpc) && env.ALLOW_PLAINTEXT_KEY !== '1') {
    console.error('DEPLOYER_KEY would put the private key on the command line, visible to every process on this host (ps, /proc, logs).')
    console.error('Use a keystore instead: cast wallet import <name> --interactive, then WALLET_ARGS="--account <name> --password-file ~/.halve.pass" in the env file. ALLOW_PLAINTEXT_KEY=1 overrides.')
    process.exit(2)
  }
}

/** Unsigned integer string, or null. */
export const uintOrNull = (v) => (typeof v === 'string' && /^\d+$/.test(v) ? v : null)
