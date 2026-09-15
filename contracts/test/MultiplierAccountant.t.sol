// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {MultiplierAccountant} from "../src/MultiplierAccountant.sol";
import {IStockToken} from "../src/interfaces/IStockToken.sol";
import {MockStockToken} from "../src/mocks/MockStockToken.sol";

contract MultiplierAccountantTest is Test {
    uint256 constant WAD = 1e18;
    MockStockToken stock;
    MultiplierAccountant acct;
    address guardian = makeAddr("guardian");

    function setUp() public {
        stock = new MockStockToken("JPM Equity Premium Income", "JEPI");
        acct = new MultiplierAccountant(IStockToken(address(stock)), guardian);
    }

    function test_initialState() public view {
        assertEq(acct.dividendIndex(), WAD);
        assertEq(acct.splitFactor(), WAD);
        assertTrue(acct.isSynced());
        assertEq(acct.checkpointCount(), 0);
        assertEq(acct.dividendIndexAt(block.timestamp), WAD);
    }

    function test_dividendIsClassifiedAutomatically() public {
        stock.setUIMultiplier(1.0065e18);
        acct.sync();
        assertEq(acct.dividendIndex(), 1.0065e18);
        assertEq(acct.splitFactor(), WAD);
        assertEq(acct.checkpointCount(), 1);
        (uint64 ts, uint8 kind, uint256 ratio, uint256 idx) = acct.checkpointAt(0);
        assertEq(ts, uint64(block.timestamp));
        assertEq(kind, acct.KIND_DIVIDEND());
        assertEq(ratio, 1.0065e18);
        assertEq(idx, 1.0065e18);
        assertTrue(acct.isSynced());
    }

    function test_dividendsCompound() public {
        stock.setUIMultiplier(1.0065e18);
        acct.sync();
        stock.setUIMultiplier(1.0065e18 * 1.0065e18 / WAD);
        acct.sync();
        assertApproxEqRel(acct.dividendIndex(), 1.01304225e18, 1e12);
        assertEq(acct.checkpointCount(), 2);
    }

    function test_syncIsIdempotent() public {
        acct.sync();
        acct.sync();
        assertEq(acct.checkpointCount(), 0);
    }

    function test_twoForOneSplitIsClassifiedAutomatically() public {
        stock.setUIMultiplier(2e18);
        acct.sync();
        assertEq(acct.splitFactor(), 2e18);
        assertEq(acct.dividendIndex(), WAD);
        (, uint8 kind,,) = acct.checkpointAt(0);
        assertEq(kind, acct.KIND_SPLIT());
    }

    function test_threeForTwoAndReverseSplits() public {
        stock.setUIMultiplier(1.5e18);
        acct.sync();
        assertEq(acct.splitFactor(), 1.5e18);
        stock.setUIMultiplier(1.5e18 / 4);
        acct.sync();
        assertEq(acct.splitFactor(), 0.375e18);
        assertTrue(acct.isSynced());
    }

    function test_splitToleratesIssuerRounding() public {
        stock.setUIMultiplier(2e18 + 1e11); // 2.0000001
        acct.sync();
        assertTrue(acct.isSynced());
        (, uint8 kind,,) = acct.checkpointAt(0);
        assertEq(kind, acct.KIND_SPLIT());
    }

    function test_specialDividendIsHeld() public {
        stock.setUIMultiplier(1.0381e18);
        acct.sync();
        assertFalse(acct.isSynced());
        (bool exists, uint64 ts, uint256 oldM, uint256 newM) = acct.pending();
        assertTrue(exists);
        assertEq(ts, uint64(block.timestamp));
        assertEq(oldM, WAD);
        assertEq(newM, 1.0381e18);
        assertEq(acct.dividendIndex(), WAD); // nothing applied yet
        vm.expectRevert("Accountant: held");
        acct.sync();
    }

    function test_oddRatioIsHeld() public {
        stock.setUIMultiplier(1.2345678e18);
        acct.sync();
        assertFalse(acct.isSynced());
    }

    function test_guardianResolvesAfterTimelockOnly() public {
        uint8 special = acct.KIND_SPECIAL(); // cached: an external call in the argument list would consume the cheatcode
        stock.setUIMultiplier(1.0381e18);
        acct.sync();
        vm.prank(guardian);
        vm.expectRevert("Accountant: timelock");
        acct.resolvePending(special);
        vm.warp(block.timestamp + 2 days);
        vm.expectRevert("Accountant: guardian only");
        acct.resolvePending(special);
        vm.prank(guardian);
        acct.resolvePending(special);
        assertTrue(acct.isSynced());
        assertEq(acct.dividendIndex(), 1.0381e18);
        (, uint8 kind,,) = acct.checkpointAt(0);
        assertEq(kind, special);
    }

    function test_guardianCanResolveHeldChangeAsSplit() public {
        stock.setUIMultiplier(1.2345678e18);
        acct.sync();
        uint8 split = acct.KIND_SPLIT();
        vm.warp(block.timestamp + 2 days);
        vm.prank(guardian);
        acct.resolvePending(split);
        assertEq(acct.splitFactor(), 1.2345678e18);
        assertEq(acct.dividendIndex(), WAD);
    }

    function test_resolveRejectsPlainDividendKind() public {
        stock.setUIMultiplier(1.0381e18);
        acct.sync();
        uint8 dividend = acct.KIND_DIVIDEND();
        vm.warp(block.timestamp + 2 days);
        vm.prank(guardian);
        vm.expectRevert("Accountant: bad kind");
        acct.resolvePending(dividend);
    }

    function test_dividendIndexAtLooksUpHistory() public {
        uint256 t0 = block.timestamp;
        stock.setUIMultiplier(1.01e18);
        acct.sync(); // at t0
        vm.warp(t0 + 100);
        stock.setUIMultiplier(1.01e18 * 1.02e18 / WAD);
        acct.sync(); // at t0+100
        assertEq(acct.dividendIndexAt(t0 - 1), WAD);
        assertEq(acct.dividendIndexAt(t0), 1.01e18);
        assertEq(acct.dividendIndexAt(t0 + 50), 1.01e18);
        assertEq(acct.dividendIndexAt(t0 + 100), acct.dividendIndex());
        assertEq(acct.dividendIndexAt(t0 + 1000), acct.dividendIndex());
    }

    function test_zeroMultiplierIsRefusedNotHeld() public {
        vm.mockCall(address(stock), abi.encodeWithSelector(IStockToken.uiMultiplier.selector), abi.encode(uint256(0)));
        vm.expectRevert("Accountant: zero multiplier");
        acct.sync();
        vm.clearMockedCalls();
        assertTrue(acct.isSynced());
        stock.setUIMultiplier(1.0065e18);
        acct.sync();
        assertEq(acct.dividendIndex(), 1.0065e18);
    }

    function test_guardianCanDismissAHeldChangeSoSyncRereads() public {
        stock.setUIMultiplier(1.05e18);
        acct.sync();
        assertFalse(acct.isSynced());
        vm.expectRevert("Accountant: guardian only");
        acct.dismissPending();
        vm.prank(guardian);
        acct.dismissPending();
        assertTrue(acct.isSynced());
        stock.setUIMultiplier(1.0065e18); // the issuer corrected the value
        acct.sync();
        assertEq(acct.dividendIndex(), 1.0065e18);
        assertEq(acct.checkpointCount(), 1);
        vm.prank(guardian);
        vm.expectRevert("Accountant: nothing pending");
        acct.dismissPending();
    }

    function test_roundingJitterIsNotACorporateAction() public {
        stock.setUIMultiplier(2e18);
        acct.sync();
        assertEq(acct.splitFactor(), 2e18);
        stock.setUIMultiplier(2e18 + 1);
        acct.sync();
        assertTrue(acct.isSynced());
        assertEq(acct.checkpointCount(), 1);
        assertEq(acct.lastMultiplier(), 2e18 + 1);
        stock.setUIMultiplier(2e18 - 1);
        acct.sync();
        assertTrue(acct.isSynced());
        assertEq(acct.dividendIndex(), WAD);
    }

    function test_classifyBands() public view {
        (uint8 k1, bool a1) = acct.classify(1.03e18);
        assertEq(k1, acct.KIND_DIVIDEND());
        assertTrue(a1);
        (, bool a2) = acct.classify(1.030000000001e18);
        assertFalse(a2);
        (uint8 k3, bool a3) = acct.classify(0.5e18);
        assertEq(k3, acct.KIND_SPLIT());
        assertTrue(a3);
        (, bool a4) = acct.classify(0.9e18);
        assertFalse(a4);
    }
}
