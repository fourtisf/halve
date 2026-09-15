// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Test double for the reads the app makes on a Uniswap v3 pool.
contract MockV3Pool {
    address public immutable token0;
    address public immutable token1;
    uint24 public constant fee = 3000;
    uint160 public sqrtPriceX96;
    int24 public tick;

    event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick);

    constructor(address a, address b, uint160 _sqrtPriceX96) {
        (token0, token1) = a < b ? (a, b) : (b, a);
        sqrtPriceX96 = _sqrtPriceX96;
    }

    function slot0() external view returns (uint160, int24, uint16, uint16, uint16, uint8, bool) {
        return (sqrtPriceX96, tick, 0, 1, 1, 0, true);
    }

    function liquidity() external pure returns (uint128) {
        return 1e18;
    }

    /// @notice Move the price and emit a Swap so log-based charts see it.
    function setPrice(uint160 _sqrtPriceX96) external {
        sqrtPriceX96 = _sqrtPriceX96;
        emit Swap(msg.sender, msg.sender, 0, 0, _sqrtPriceX96, 1e18, tick);
    }
}
