/**
 * Limit orders on Uniswap v3 without a new contract: a "range order" is a single-tick liquidity position
 * placed entirely on one side of the current price. When the price crosses the range, the pool converts the
 * deposit into the other token at the range's prices (the limit or better), and the position earns the pool
 * fee on top instead of paying it. Closing the position (decreaseLiquidity + collect + burn) returns whatever
 * it holds: the proceeds after a fill, the deposit before one, a mix while the price sits inside the range.
 * If the price crosses back before the position is closed, the pool converts it back, so a filled order is
 * something to claim, not something that stays filled by itself. Pure maths and ABI here; the hook does I/O.
 */
import { encodeFunctionData, maxUint128, maxUint256, type Address, type Hex } from 'viem'

export const Q96 = 2n ** 96n
export const MIN_TICK = -887272
export const MAX_TICK = 887272

export type OrderSide = 'buy' | 'sell'
export type OrderStatus = 'open' | 'partial' | 'filled'

/** Uniswap v3 TickMath.getSqrtRatioAtTick, bit for bit. */
export function getSqrtRatioAtTick(tick: number): bigint {
  const absTick = tick < 0 ? -tick : tick
  if (absTick > MAX_TICK) throw new Error('tick out of range')
  let ratio = (absTick & 0x1) !== 0 ? 0xfffcb933bd6fad37aa2d162d1a594001n : 0x100000000000000000000000000000000n
  if (absTick & 0x2) ratio = (ratio * 0xfff97272373d413259a46990580e213an) >> 128n
  if (absTick & 0x4) ratio = (ratio * 0xfff2e50f5f656932ef12357cf3c7fdccn) >> 128n
  if (absTick & 0x8) ratio = (ratio * 0xffe5caca7e10e4e61c3624eaa0941cd0n) >> 128n
  if (absTick & 0x10) ratio = (ratio * 0xffcb9843d60f6159c9db58835c926644n) >> 128n
  if (absTick & 0x20) ratio = (ratio * 0xff973b41fa98c081472e6896dfb254c0n) >> 128n
  if (absTick & 0x40) ratio = (ratio * 0xff2ea16466c96a3843ec78b326b52861n) >> 128n
  if (absTick & 0x80) ratio = (ratio * 0xfe5dee046a99a2a811c461f1969c3053n) >> 128n
  if (absTick & 0x100) ratio = (ratio * 0xfcbe86c7900a88aedcffc83b479aa3a4n) >> 128n
  if (absTick & 0x200) ratio = (ratio * 0xf987a7253ac413176f2b074cf7815e54n) >> 128n
  if (absTick & 0x400) ratio = (ratio * 0xf3392b0822b70005940c7a398e4b70f3n) >> 128n
  if (absTick & 0x800) ratio = (ratio * 0xe7159475a2c29b7443b29c7fa6e889d9n) >> 128n
  if (absTick & 0x1000) ratio = (ratio * 0xd097f3bdfd2022b8845ad8f792aa5825n) >> 128n
  if (absTick & 0x2000) ratio = (ratio * 0xa9f746462d870fdf8a65dc1f90e061e5n) >> 128n
  if (absTick & 0x4000) ratio = (ratio * 0x70d869a156d2a1b890bb3df62baf32f7n) >> 128n
  if (absTick & 0x8000) ratio = (ratio * 0x31be135f97d08fd981231505542fcfa6n) >> 128n
  if (absTick & 0x10000) ratio = (ratio * 0x9aa508b5b7a84e1c677de54f3e99bc9n) >> 128n
  if (absTick & 0x20000) ratio = (ratio * 0x5d6af8dedb81196699c329225ee604n) >> 128n
  if (absTick & 0x40000) ratio = (ratio * 0x2216e584f5fa1ea926041bedfe98n) >> 128n
  if (absTick & 0x80000) ratio = (ratio * 0x48a170391f7dc42444e8fa2n) >> 128n
  if (tick > 0) ratio = maxUint256 / ratio
  // Q128.128 → Q64.96, rounding up
  return (ratio >> 32n) + (ratio % (1n << 32n) === 0n ? 0n : 1n)
}

/** token1 per token0 in human units at a tick. */
export const tickToPrice = (tick: number, dec0: number, dec1: number): number => Math.pow(1.0001, tick) * Math.pow(10, dec0 - dec1)

/** Exact (fractional) tick for a token1-per-token0 price in human units. */
export const priceToTick = (price1per0: number, dec0: number, dec1: number): number => Math.log(price1per0 * Math.pow(10, dec1 - dec0)) / Math.log(1.0001)

/** Standard tick spacing per fee tier (the factory's defaults). */
export const spacingForFee = (fee: number): number => ({ 100: 1, 500: 10, 3000: 60, 10000: 200 })[fee] ?? 60

export type PoolSide = {
  /** The Halve token (PT or YT) is token0 of the pool; the stock is the other token. */
  tokenIsToken0: boolean
  tokenDecimals: number
  stockDecimals: number
  spacing: number
}

export type OrderRange = {
  ok: boolean
  /** Why the order cannot be placed at this price (empty when ok). */
  reason: string
  tickLower: number
  tickUpper: number
  /** Which pool token the order deposits: stock for a buy, the Halve token for a sell. */
  depositIsToken0: boolean
  /** The range's prices in stock per token: the fill happens between these, i.e. at the limit or better. */
  priceLow: number
  priceHigh: number
  /** Current pool price in stock per token. */
  current: number
}

/** Stock-per-token price at a tick. */
export function stockPerTokenAt(tick: number, p: PoolSide): number {
  const dec0 = p.tokenIsToken0 ? p.tokenDecimals : p.stockDecimals
  const dec1 = p.tokenIsToken0 ? p.stockDecimals : p.tokenDecimals
  const p1per0 = tickToPrice(tick, dec0, dec1)
  return p.tokenIsToken0 ? p1per0 : 1 / p1per0
}

const floorTo = (t: number, s: number) => Math.floor(t / s) * s
const ceilTo = (t: number, s: number) => Math.ceil(t / s) * s

/**
 * The single-tick range for "buy at ≤ price" or "sell at ≥ price" (price in stock per token), given the pool's
 * current tick. A buy sits entirely below the current price and holds stock; a sell sits above and holds the
 * token. In pool terms the deposited token decides the side: token0 above the current tick, token1 below.
 */
export function orderRange(side: OrderSide, price: number, currentTick: number, p: PoolSide): OrderRange {
  const dec0 = p.tokenIsToken0 ? p.tokenDecimals : p.stockDecimals
  const dec1 = p.tokenIsToken0 ? p.stockDecimals : p.tokenDecimals
  const current = stockPerTokenAt(currentTick, p)
  const bad = (reason: string): OrderRange => ({ ok: false, reason, tickLower: 0, tickUpper: 0, depositIsToken0: false, priceLow: 0, priceHigh: 0, current })
  if (!(price > 0) || !Number.isFinite(price)) return bad('Enter a price')
  const wrongSide = side === 'buy'
    ? `A limit buy must sit below the current price (${current.toFixed(4)}). To buy now, use Market.`
    : `A limit sell must sit above the current price (${current.toFixed(4)}). To sell now, use Market.`
  if (side === 'buy' ? price >= current : price <= current) return bad(wrongSide)
  const depositIsToken0 = side === 'buy' ? !p.tokenIsToken0 : p.tokenIsToken0
  const t = priceToTick(p.tokenIsToken0 ? price : 1 / price, dec0, dec1)
  let tickLower: number, tickUpper: number
  if (depositIsToken0) {
    tickLower = ceilTo(t, p.spacing)
    tickUpper = tickLower + p.spacing
  } else {
    tickUpper = floorTo(t, p.spacing)
    tickLower = tickUpper - p.spacing
  }
  if (tickLower < MIN_TICK || tickUpper > MAX_TICK) return bad('Price out of range')
  const edges = [stockPerTokenAt(tickLower, p), stockPerTokenAt(tickUpper, p)]
  const priceLow = Math.min(...edges)
  const priceHigh = Math.max(...edges)
  // a price on the right side of the current tick's own price rounds to a range that never contains the tick
  // (floor below it for a buy, ceil above it for a sell); this guard only documents the invariant
  const clear = depositIsToken0 ? currentTick < tickLower : currentTick >= tickUpper
  if (!clear) return { ...bad(wrongSide), priceLow, priceHigh }
  return { ok: true, reason: '', tickLower, tickUpper, depositIsToken0, priceLow, priceHigh, current }
}

/** Where the price is relative to the range: open (untouched), partial (inside), filled (crossed). */
export function orderStatus(tickLower: number, tickUpper: number, depositIsToken0: boolean, currentTick: number): OrderStatus {
  if (currentTick >= tickLower && currentTick < tickUpper) return 'partial'
  if (depositIsToken0) return currentTick < tickLower ? 'open' : 'filled'
  return currentTick >= tickUpper ? 'open' : 'filled'
}

/** Token amounts a position of `liquidity` over [sqrtA, sqrtB] holds at the current sqrt price (LiquidityAmounts). */
export function amountsForLiquidity(sqrtP: bigint, sqrtA: bigint, sqrtB: bigint, liquidity: bigint): { amount0: bigint; amount1: bigint } {
  if (sqrtA > sqrtB) [sqrtA, sqrtB] = [sqrtB, sqrtA]
  const amount0 = (a: bigint, b: bigint) => (((liquidity * Q96 * (b - a)) / b) / a)
  const amount1 = (a: bigint, b: bigint) => (liquidity * (b - a)) / Q96
  if (sqrtP <= sqrtA) return { amount0: amount0(sqrtA, sqrtB), amount1: 0n }
  if (sqrtP >= sqrtB) return { amount0: 0n, amount1: amount1(sqrtA, sqrtB) }
  return { amount0: amount0(sqrtP, sqrtB), amount1: amount1(sqrtA, sqrtP) }
}

/** What a full fill returns, before the pool fee the order earns: the deposit converted at the range's mean price. */
export function expectedFill(side: OrderSide, amount: number, priceLow: number, priceHigh: number): number {
  const mean = Math.sqrt(priceLow * priceHigh)
  if (!(mean > 0)) return 0
  return side === 'buy' ? amount / mean : amount * mean
}

/** How far the fill has progressed, from what the position holds now. */
export function fillProgress(side: OrderSide, tokenIsToken0: boolean, amount0: number, amount1: number): number {
  const token = tokenIsToken0 ? amount0 : amount1
  const stock = tokenIsToken0 ? amount1 : amount0
  const have = side === 'buy' ? token : stock // what a fill produces
  const rest = side === 'buy' ? stock : token // what is still waiting
  const total = have + rest
  return total > 0 ? have / total : 0
}

export const ADDRESS_THIS: Address = '0x0000000000000000000000000000000000000002' // SwapRouter02's "send to router" recipient

export const nonfungiblePositionManagerAbi = [
  {
    type: 'function', name: 'mint', stateMutability: 'payable',
    inputs: [{ name: 'params', type: 'tuple', components: [
      { name: 'token0', type: 'address' }, { name: 'token1', type: 'address' }, { name: 'fee', type: 'uint24' },
      { name: 'tickLower', type: 'int24' }, { name: 'tickUpper', type: 'int24' },
      { name: 'amount0Desired', type: 'uint256' }, { name: 'amount1Desired', type: 'uint256' },
      { name: 'amount0Min', type: 'uint256' }, { name: 'amount1Min', type: 'uint256' },
      { name: 'recipient', type: 'address' }, { name: 'deadline', type: 'uint256' },
    ] }],
    outputs: [{ name: 'tokenId', type: 'uint256' }, { name: 'liquidity', type: 'uint128' }, { name: 'amount0', type: 'uint256' }, { name: 'amount1', type: 'uint256' }],
  },
  {
    type: 'function', name: 'positions', stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [
      { name: 'nonce', type: 'uint96' }, { name: 'operator', type: 'address' }, { name: 'token0', type: 'address' }, { name: 'token1', type: 'address' },
      { name: 'fee', type: 'uint24' }, { name: 'tickLower', type: 'int24' }, { name: 'tickUpper', type: 'int24' }, { name: 'liquidity', type: 'uint128' },
      { name: 'feeGrowthInside0LastX128', type: 'uint256' }, { name: 'feeGrowthInside1LastX128', type: 'uint256' },
      { name: 'tokensOwed0', type: 'uint128' }, { name: 'tokensOwed1', type: 'uint128' },
    ],
  },
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { type: 'function', name: 'tokenOfOwnerByIndex', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'index', type: 'uint256' }], outputs: [{ name: '', type: 'uint256' }] },
  {
    type: 'function', name: 'decreaseLiquidity', stateMutability: 'payable',
    inputs: [{ name: 'params', type: 'tuple', components: [
      { name: 'tokenId', type: 'uint256' }, { name: 'liquidity', type: 'uint128' }, { name: 'amount0Min', type: 'uint256' }, { name: 'amount1Min', type: 'uint256' }, { name: 'deadline', type: 'uint256' },
    ] }],
    outputs: [{ name: 'amount0', type: 'uint256' }, { name: 'amount1', type: 'uint256' }],
  },
  {
    type: 'function', name: 'collect', stateMutability: 'payable',
    inputs: [{ name: 'params', type: 'tuple', components: [
      { name: 'tokenId', type: 'uint256' }, { name: 'recipient', type: 'address' }, { name: 'amount0Max', type: 'uint128' }, { name: 'amount1Max', type: 'uint128' },
    ] }],
    outputs: [{ name: 'amount0', type: 'uint256' }, { name: 'amount1', type: 'uint256' }],
  },
  { type: 'function', name: 'burn', stateMutability: 'payable', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'multicall', stateMutability: 'payable', inputs: [{ name: 'data', type: 'bytes[]' }], outputs: [{ name: 'results', type: 'bytes[]' }] },
  {
    type: 'event', name: 'IncreaseLiquidity',
    inputs: [{ name: 'tokenId', type: 'uint256', indexed: true }, { name: 'liquidity', type: 'uint128', indexed: false }, { name: 'amount0', type: 'uint256', indexed: false }, { name: 'amount1', type: 'uint256', indexed: false }],
  },
  {
    type: 'event', name: 'Transfer',
    inputs: [{ name: 'from', type: 'address', indexed: true }, { name: 'to', type: 'address', indexed: true }, { name: 'tokenId', type: 'uint256', indexed: true }],
  },
] as const

/** One NPM multicall that empties and burns a position: whatever it holds (deposit, proceeds or a mix) goes to `owner`. */
export function encodeClose(tokenId: bigint, liquidity: bigint, owner: Address, deadline: bigint): Hex[] {
  const calls: Hex[] = []
  if (liquidity > 0n) calls.push(encodeFunctionData({ abi: nonfungiblePositionManagerAbi, functionName: 'decreaseLiquidity', args: [{ tokenId, liquidity, amount0Min: 0n, amount1Min: 0n, deadline }] }))
  calls.push(encodeFunctionData({ abi: nonfungiblePositionManagerAbi, functionName: 'collect', args: [{ tokenId, recipient: owner, amount0Max: maxUint128, amount1Max: maxUint128 }] }))
  calls.push(encodeFunctionData({ abi: nonfungiblePositionManagerAbi, functionName: 'burn', args: [tokenId] }))
  return calls
}
