/** Deploys the real Uniswap v3 factory + position manager (published artifacts) on a local chain. */
import { createRequire } from 'node:module'
import { createPublicClient, createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

const require = createRequire(import.meta.url)

export async function deployUniswap(rpc, deployerKey, weth9) {
  const account = privateKeyToAccount(deployerKey)
  const wallet = createWalletClient({ account, transport: http(rpc) })
  const pub = createPublicClient({ transport: http(rpc) })
  const deploy = async (artifact, args) => {
    const { abi, bytecode } = require(artifact)
    const hash = await wallet.deployContract({ abi, bytecode, args, chain: null })
    const rc = await pub.waitForTransactionReceipt({ hash })
    if (rc.status !== 'success' || !rc.contractAddress) throw new Error(`deploy failed: ${artifact}`)
    return rc.contractAddress
  }
  const factory = await deploy('@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json', [])
  // WETH9 and the token descriptor are never used by our flows (no ETH pairs, no tokenURI); any non-zero address will do
  const npm = await deploy('@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json', [factory, weth9, '0x0000000000000000000000000000000000000001'])
  // SwapRouter02(factoryV2, factoryV3, positionManager, WETH9): no v2 factory locally
  const router = await deploy('@uniswap/swap-router-contracts/artifacts/contracts/SwapRouter02.sol/SwapRouter02.json', ['0x0000000000000000000000000000000000000001', factory, npm, weth9])
  return { factory, npm, router }
}
