// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {StripVault} from "../src/StripVault.sol";
import {IStockToken} from "../src/interfaces/IStockToken.sol";
import {INonfungiblePositionManager, IUniswapV3PoolMinimal} from "../src/interfaces/IUniswapV3.sol";
import {PriceMath} from "../src/libraries/PriceMath.sol";

/// @notice Creates (and optionally seeds) the PT / QUOTE and YT / QUOTE Uniswap v3 pools of one series.
/// Env: NPM (NonfungiblePositionManager), QUOTE (the stock token: raw balances do not rebase, so Uniswap v3 is
///      fine with it), VAULT (or PT + YT), [FEE=3000] [PT_PRICE=0.96e18] [YT_PRICE=0.04e18] quote per token (WAD),
///      [SEED_PT] [SEED_QUOTE_PT] [SEED_YT] [SEED_QUOTE_YT] full-range liquidity from the broadcaster,
///      [OUT=deployments/pools.json]
contract CreatePools is Script {
    function run() external virtual {
        address npm = vm.envAddress("NPM");
        address quote = vm.envAddress("QUOTE");
        address pt = vm.envOr("PT", address(0));
        address yt = vm.envOr("YT", address(0));
        if (pt == address(0)) {
            StripVault v = StripVault(vm.envAddress("VAULT"));
            pt = address(v.pt());
            yt = address(v.yt());
        }
        uint24 fee = uint24(vm.envOr("FEE", uint256(3000)));
        vm.startBroadcast();
        address poolPT = _pool(npm, pt, quote, fee, vm.envOr("PT_PRICE", uint256(0.96e18)), vm.envOr("SEED_PT", uint256(0)), vm.envOr("SEED_QUOTE_PT", uint256(0)), msg.sender);
        address poolYT = _pool(npm, yt, quote, fee, vm.envOr("YT_PRICE", uint256(0.04e18)), vm.envOr("SEED_YT", uint256(0)), vm.envOr("SEED_QUOTE_YT", uint256(0)), msg.sender);
        vm.stopBroadcast();
        _write(poolPT, poolYT, quote, fee, vm.envOr("OUT", string("deployments/pools.json")));
    }

    /// @dev Create + initialise at `priceWad` quote per token, then mint a full-range position if seeds are given.
    function _pool(address npm, address token, address quote, uint24 fee, uint256 priceWad, uint256 seedToken, uint256 seedQuote, address recipient)
        internal
        returns (address pool)
    {
        (address t0, address t1) = token < quote ? (token, quote) : (quote, token);
        uint160 sqrt = PriceMath.sqrtPriceX96(token, quote, priceWad, IStockToken(token).decimals(), IStockToken(quote).decimals());
        pool = INonfungiblePositionManager(npm).createAndInitializePoolIfNecessary(t0, t1, fee, sqrt);
        _requirePrice(pool, sqrt);
        if (seedToken > 0 && seedQuote > 0) {
            IStockToken(token).approve(npm, seedToken);
            IStockToken(quote).approve(npm, seedQuote);
            int24 spacing = IUniswapV3PoolMinimal(pool).tickSpacing();
            (uint256 a0, uint256 a1) = token < quote ? (seedToken, seedQuote) : (seedQuote, seedToken);
            INonfungiblePositionManager(npm).mint(
                INonfungiblePositionManager.MintParams({
                    token0: t0,
                    token1: t1,
                    fee: fee,
                    tickLower: (-887272 / spacing) * spacing,
                    tickUpper: (887272 / spacing) * spacing,
                    amount0Desired: a0,
                    amount1Desired: a1,
                    amount0Min: (a0 * 99) / 100,
                    amount1Min: (a1 * 99) / 100,
                    recipient: recipient,
                    deadline: block.timestamp + 3600
                })
            );
        }
        console2.log("pool", token, pool);
    }

    /// @dev An existing pool keeps its own price: refuse to seed into a number somebody else set (front-run).
    function _requirePrice(address pool, uint160 sqrt) internal view {
        (uint160 actual,,,,,,) = IUniswapV3PoolMinimal(pool).slot0();
        require(actual >= (uint256(sqrt) * 995) / 1000 && actual <= (uint256(sqrt) * 1005) / 1000, "pool already initialised at another price");
    }

    function _write(address poolPT, address poolYT, address quote, uint24 fee, string memory out) internal {
        string memory k = "pools";
        vm.serializeAddress(k, "poolPT", poolPT);
        vm.serializeAddress(k, "poolYT", poolYT);
        vm.serializeAddress(k, "quoteToken", quote);
        string memory json = vm.serializeUint(k, "fee", fee);
        vm.writeFile(out, json);
        console2.log(json);
    }
}

/// @notice Split-and-seed in one go, on any chain: the broadcaster splits AMOUNT raw stock (gets PT + YT), then
/// creates both pools quoted in the stock token and seeds them full-range at PT_PRICE / YT_PRICE. Needs about
/// 2 × AMOUNT stock in the broadcaster's wallet. Env: VAULT, NPM, [AMOUNT=10000e18] [FEE] [PT_PRICE] [YT_PRICE] [OUT].
contract SeedPools is CreatePools {
    function run() external override {
        StripVault vault = StripVault(vm.envAddress("VAULT"));
        IStockToken stock = vault.stock();
        address npm = vm.envAddress("NPM");
        uint256 amount = vm.envOr("AMOUNT", uint256(10_000e18));
        uint24 fee = uint24(vm.envOr("FEE", uint256(3000)));
        uint256 ptPrice = vm.envOr("PT_PRICE", uint256(0.96e18));
        uint256 ytPrice = vm.envOr("YT_PRICE", uint256(0.04e18));

        vm.startBroadcast();
        stock.approve(address(vault), amount);
        uint256 base = vault.split(amount);
        // full-range at price P uses quote = base × P, so the seeds are spent completely
        address poolPT = _pool(npm, address(vault.pt()), address(stock), fee, ptPrice, base, (base * ptPrice) / 1e18, msg.sender);
        address poolYT = _pool(npm, address(vault.yt()), address(stock), fee, ytPrice, base, (base * ytPrice) / 1e18, msg.sender);
        vm.stopBroadcast();
        _write(poolPT, poolYT, address(stock), fee, vm.envOr("OUT", string("pools.local.json")));
    }
}
