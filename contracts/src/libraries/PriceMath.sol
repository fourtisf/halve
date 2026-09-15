// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Uniswap v3 price helpers shared by the deploy scripts.
library PriceMath {
    uint256 internal constant WAD = 1e18;
    uint256 internal constant Q96 = 2 ** 96;

    /// @dev sqrtPriceX96 for a pool of `token` / `quote` where one token costs `priceWad` quote (human units).
    /// Handles Uniswap's address ordering and differing decimals.
    function sqrtPriceX96(address token, address quote, uint256 priceWad, uint8 decToken, uint8 decQuote) internal pure returns (uint160) {
        require(priceWad > 0, "PriceMath: zero price");
        bool tokenIs0 = token < quote;
        uint256 p = tokenIs0 ? priceWad : (WAD * WAD) / priceWad; // token1 per token0, human units, WAD
        uint8 dec0 = tokenIs0 ? decToken : decQuote;
        uint8 dec1 = tokenIs0 ? decQuote : decToken;
        if (dec1 >= dec0) p = p * 10 ** (dec1 - dec0);
        else p = p / 10 ** (dec0 - dec1);
        return uint160((isqrt(p * WAD) * Q96) / WAD);
    }

    function isqrt(uint256 x) internal pure returns (uint256 y) {
        if (x == 0) return 0;
        uint256 z = (x + 1) / 2;
        y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
    }
}
