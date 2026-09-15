// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {WrappedStock} from "../src/WrappedStock.sol";
import {IStockToken} from "../src/interfaces/IStockToken.sol";
import {MockStockToken} from "../src/mocks/MockStockToken.sol";
import {PriceMath} from "../src/libraries/PriceMath.sol";

contract WrappedStockTest is Test {
    MockStockToken stock;
    WrappedStock w;
    address alice = makeAddr("alice");

    function setUp() public {
        stock = new MockStockToken("JPM Equity Premium Income", "JEPI");
        w = new WrappedStock(IStockToken(address(stock)));
        stock.mint(alice, 1_000e18);
        vm.prank(alice);
        stock.approve(address(w), type(uint256).max);
    }

    function test_namesAndDecimals() public view {
        assertEq(w.name(), "Wrapped JPM Equity Premium Income");
        assertEq(w.symbol(), "wJEPI");
        assertEq(w.decimals(), 18);
    }

    function test_wrapIsOneToOneAtMultiplierOne() public {
        vm.prank(alice);
        uint256 shares = w.wrap(100e18);
        assertEq(shares, 100e18);
        assertEq(w.balanceOf(alice), 100e18);
        assertEq(w.totalSupply(), 100e18);
    }

    function test_balanceDoesNotRebaseButValueDoes() public {
        vm.prank(alice);
        w.wrap(100e18);
        stock.setUIMultiplier(1.0065e18);
        assertEq(w.balanceOf(alice), 100e18); // shares are constant
        assertEq(w.amountFor(100e18), 100.65e18); // their stock value grew
        assertEq(w.stockPerShare(), 1.0065e18);
        vm.prank(alice);
        uint256 out = w.unwrap(100e18);
        assertApproxEqAbs(out, 100.65e18, 2);
        assertEq(w.totalSupply(), 0);
    }

    function test_wrapAfterDividendGivesFewerShares() public {
        stock.setUIMultiplier(2e18); // 2:1 split
        vm.prank(alice);
        uint256 shares = w.wrap(100e18);
        assertEq(shares, 50e18);
    }

    function testFuzz_wrapUnwrapIsLossless(uint96 amount, uint64 growthBps) public {
        vm.assume(amount >= 1e9 && amount <= 1_000e18);
        stock.setUIMultiplier(1e18 + (uint256(growthBps) % 5000) * 1e14); // up to +50 %
        vm.startPrank(alice);
        uint256 shares = w.wrap(amount);
        uint256 out = w.unwrap(shares);
        vm.stopPrank();
        assertLe(out, amount);
        assertApproxEqAbs(out, amount, 4);
    }

    function test_sqrtPriceRoundTrips() public pure {
        address a = address(0x1000);
        address b = address(0x2000);
        // token a (token0) at 0.96 b: price1per0 = 0.96 → sqrt = 0.9798 × 2^96
        uint160 s = PriceMath.sqrtPriceX96(a, b, 0.96e18, 18, 18);
        uint256 p = (((uint256(s) * uint256(s)) >> 96) * 1e18) >> 96;
        assertApproxEqRel(p, 0.96e18, 1e9);
        // token b priced in a: b is token1, so price1per0 = 1 / 0.04 = 25
        uint160 s2 = PriceMath.sqrtPriceX96(b, a, 0.04e18, 18, 18);
        uint256 p2 = (((uint256(s2) * uint256(s2)) >> 96) * 1e18) >> 96;
        assertApproxEqRel(p2, 25e18, 1e9);
        // 6-decimal quote: 0.96 USDC per token0 (18 dec) → raw ratio 0.96e-12
        uint160 s3 = PriceMath.sqrtPriceX96(a, b, 0.96e18, 18, 6);
        uint256 p3 = (((uint256(s3) * uint256(s3)) >> 96) * 1e30) >> 96;
        assertApproxEqRel(p3, 0.96e18, 1e6);
    }
}
