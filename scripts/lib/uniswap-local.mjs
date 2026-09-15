/** Deploys the real Uniswap v3 stack (published artifacts) plus a WETH9 on a local chain, and seeds a WETH/stock pool. */
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createPublicClient, createWalletClient, http, parseAbi } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

const require = createRequire(import.meta.url)
const root = resolve(new URL('../..', import.meta.url).pathname)
const WAD = 10n ** 18n
const Q96 = 2n ** 96n

function isqrt(x) {
  if (x < 2n) return x
  let z = (x + 1n) / 2n, y = x
  while (z < y) { y = z; z = (x / z + z) / 2n }
  return y
}
/** sqrtPriceX96 for `token`/`quote` at `priceWad` quote per token (both 18 decimals), Uniswap ordering applied. */
export function sqrtPriceX96(token, quote, priceWad) {
  const tokenIs0 = token.toLowerCase() < quote.toLowerCase()
  const p = tokenIs0 ? priceWad : (WAD * WAD) / priceWad
  return (isqrt(p * WAD) * Q96) / WAD
}

const NPM_ABI = parseAbi([
  'function createAndInitializePoolIfNecessary(address token0, address token1, uint24 fee, uint160 sqrtPriceX96) payable returns (address pool)',
  'function mint((address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline)) payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)',
])
const ERC20_ABI = parseAbi(['function approve(address, uint256) returns (bool)', 'function deposit() payable', 'function mint(address, uint256)'])

function clients(rpc, key) {
  const account = privateKeyToAccount(key)
  return { account, wallet: createWalletClient({ account, transport: http(rpc) }), pub: createPublicClient({ transport: http(rpc) }) }
}

export async function deployUniswap(rpc, deployerKey) {
  const { wallet, pub } = clients(rpc, deployerKey)
  const deploy = async (artifact, args) => {
    const { abi, bytecode } = artifact
    const hash = await wallet.deployContract({ abi, bytecode: typeof bytecode === 'string' ? bytecode : bytecode.object, args, chain: null })
    const rc = await pub.waitForTransactionReceipt({ hash })
    if (rc.status !== 'success' || !rc.contractAddress) throw new Error('deploy failed')
    return rc.contractAddress
  }
  const weth = await deploy(JSON.parse(readFileSync(resolve(root, 'contracts/out/WETH9.sol/WETH9.json'), 'utf8')), [])
  const factory = await deploy(require('@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json'), [])
  const npm = await deploy(require('@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json'), [factory, weth, '0x0000000000000000000000000000000000000001'])
  const router = await deploy(require('@uniswap/swap-router-contracts/artifacts/contracts/SwapRouter02.sol/SwapRouter02.json'), ['0x0000000000000000000000000000000000000001', factory, npm, weth])
  const quoter = await deploy(require('@uniswap/swap-router-contracts/artifacts/contracts/lens/QuoterV2.sol/QuoterV2.json'), [factory, weth])
  return { weth, factory, npm, router, quoter }
}

/** Wraps ETH and mints mock stock, then creates + seeds a full-range WETH/stock pool at `stockPerEth` (WAD). */
export async function seedWethPool(rpc, deployerKey, { npm, weth, stock, ethAmount, stockPerEth, fee = 3000 }) {
  const { account, wallet, pub } = clients(rpc, deployerKey)
  const send = async (req) => { const hash = await wallet.writeContract({ ...req, chain: null }); const rc = await pub.waitForTransactionReceipt({ hash }); if (rc.status !== 'success') throw new Error(`tx failed: ${req.functionName}`); return rc }
  const stockAmount = (ethAmount * stockPerEth) / WAD
  await send({ address: weth, abi: ERC20_ABI, functionName: 'deposit', value: ethAmount })
  await send({ address: stock, abi: ERC20_ABI, functionName: 'mint', args: [account.address, stockAmount] })
  await send({ address: weth, abi: ERC20_ABI, functionName: 'approve', args: [npm, ethAmount] })
  await send({ address: stock, abi: ERC20_ABI, functionName: 'approve', args: [npm, stockAmount] })
  const [t0, t1] = weth.toLowerCase() < stock.toLowerCase() ? [weth, stock] : [stock, weth]
  const sqrt = sqrtPriceX96(weth, stock, stockPerEth) // price of 1 WETH in stock
  const { result: pool } = await pub.simulateContract({ address: npm, abi: NPM_ABI, functionName: 'createAndInitializePoolIfNecessary', args: [t0, t1, fee, sqrt], account })
  await send({ address: npm, abi: NPM_ABI, functionName: 'createAndInitializePoolIfNecessary', args: [t0, t1, fee, sqrt] })
  const spacing = 60n
  const lower = Number((-887272n / spacing) * spacing), upper = Number((887272n / spacing) * spacing)
  const [a0, a1] = t0 === weth ? [ethAmount, stockAmount] : [stockAmount, ethAmount]
  await send({ address: npm, abi: NPM_ABI, functionName: 'mint', args: [{ token0: t0, token1: t1, fee, tickLower: lower, tickUpper: upper, amount0Desired: a0, amount1Desired: a1, amount0Min: 0n, amount1Min: 0n, recipient: account.address, deadline: BigInt(Math.floor(Date.now() / 1000) + 3600) }] })
  return pool
}
