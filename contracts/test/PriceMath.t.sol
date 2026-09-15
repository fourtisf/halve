// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {PriceMath} from "../src/libraries/PriceMath.sol";

contract PriceMathTest is Test {
    function test_sqrtPriceRoundTrips() public pure {
        address a = address(0x1000);
        address b = address(0x2000);
        uint160 s = PriceMath.sqrtPriceX96(a, b, 0.96e18, 18, 18);
        uint256 p = (((uint256(s) * uint256(s)) >> 96) * 1e18) >> 96;
        assertApproxEqRel(p, 0.96e18, 1e9);
        uint160 s2 = PriceMath.sqrtPriceX96(b, a, 0.04e18, 18, 18);
        uint256 p2 = (((uint256(s2) * uint256(s2)) >> 96) * 1e18) >> 96;
        assertApproxEqRel(p2, 25e18, 1e9);
        uint160 s3 = PriceMath.sqrtPriceX96(a, b, 0.96e18, 18, 6);
        uint256 p3 = (((uint256(s3) * uint256(s3)) >> 96) * 1e30) >> 96;
        assertApproxEqRel(p3, 0.96e18, 1e6);
    }
}
