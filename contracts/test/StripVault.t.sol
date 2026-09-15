// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {StripVault} from "../src/StripVault.sol";
import {MultiplierAccountant} from "../src/MultiplierAccountant.sol";
import {IStockToken} from "../src/interfaces/IStockToken.sol";
import {MockStockToken} from "../src/mocks/MockStockToken.sol";

contract StripVaultTest is Test {
    uint256 constant WAD = 1e18;
    MockStockToken stock;
    MultiplierAccountant acct;
    StripVault vault;
    address treasury = makeAddr("treasury");
    address guardian = makeAddr("guardian");
    address owner = makeAddr("owner");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    uint256 maturity;

    function setUp() public {
        stock = new MockStockToken("JPM Equity Premium Income", "JEPI");
        acct = new MultiplierAccountant(IStockToken(address(stock)), guardian);
        maturity = block.timestamp + 180 days;
        vault = new StripVault(IStockToken(address(stock)), acct, "JEPI", maturity, 1_000_000e18, treasury, owner);
        stock.mint(alice, 1_000e18);
        stock.mint(bob, 1_000e18);
        vm.prank(alice);
        stock.approve(address(vault), type(uint256).max);
        vm.prank(bob);
        stock.approve(address(vault), type(uint256).max);
    }

    function _dividend(uint256 ratio) internal {
        stock.setUIMultiplier(stock.uiMultiplier() * ratio / WAD);
        acct.sync();
    }

    function test_tokensAreNamedFromTheTicker() public view {
        assertEq(vault.pt().symbol(), "pJEPI");
        assertEq(vault.yt().symbol(), "yJEPI");
        assertEq(vault.pt().decimals(), 18);
        assertEq(vault.state(), vault.STATE_ACTIVE());
        assertEq(vault.d0(), WAD);
        assertEq(vault.factor(), WAD);
    }

    function test_splitTakesTenBpsAndMintsBothHalves() public {
        vm.prank(alice);
        uint256 base = vault.split(100e18);
        assertEq(base, 99.9e18);
        assertEq(vault.pt().balanceOf(alice), 99.9e18);
        assertEq(vault.yt().balanceOf(alice), 99.9e18);
        assertEq(stock.balanceOf(treasury), 0.1e18);
        assertEq(vault.totalDeposits(), 99.9e18);
        assertApproxEqAbs(stock.balanceOf(address(vault)), 99.9e18, 2);
    }

    function test_mergeIsFreeAndReturnsTheShare() public {
        vm.startPrank(alice);
        vault.split(100e18);
        uint256 before = stock.balanceOf(alice);
        uint256 out = vault.merge(99.9e18);
        vm.stopPrank();
        assertEq(out, 99.9e18);
        assertApproxEqAbs(stock.balanceOf(alice) - before, 99.9e18, 2);
        assertEq(vault.totalDeposits(), 0);
    }

    function test_mergeNeedsBothHalves() public {
        vm.startPrank(alice);
        vault.split(100e18);
        vault.yt().transfer(bob, 50e18);
        vm.expectRevert("ERC20: burn");
        vault.merge(99.9e18);
        vm.stopPrank();
    }

    function test_capIsEnforced() public {
        vm.prank(owner);
        vault.setCap(150e18);
        vm.prank(alice);
        vault.split(100e18);
        vm.prank(bob);
        vm.expectRevert("Vault: cap");
        vault.split(100e18);
        vm.expectRevert("Vault: owner only");
        vault.setCap(1);
    }

    function test_laterDepositorsGetFewerBaseUnitsAfterADividend() public {
        vm.prank(alice);
        vault.split(100e18);
        _dividend(1.0065e18);
        vm.prank(bob);
        uint256 base = vault.split(100e18);
        assertApproxEqRel(base, 99.9e18 * WAD / 1.0065e18, 1e12);
        // both merges are still backed
        vm.prank(alice);
        uint256 a = vault.merge(99.9e18);
        vm.prank(bob);
        uint256 b = vault.merge(base);
        assertApproxEqRel(a, 99.9e18 * 1.0065e18 / WAD, 1e12);
        assertApproxEqRel(b, 99.9e18, 1e12);
        assertLe(vault.liabilities(), stock.balanceOf(address(vault)) + 10);
    }

    function test_splitPausesWhileHeldButMergeDoesNot() public {
        vm.prank(alice);
        vault.split(100e18);
        stock.setUIMultiplier(1.0381e18);
        acct.sync(); // held
        vm.prank(bob);
        vm.expectRevert("Vault: accountant held");
        vault.split(10e18);
        vm.prank(alice);
        uint256 out = vault.merge(10e18);
        assertEq(out, 10e18); // stale factor: the unclassified growth stays in the vault until resolved
    }

    function test_settleAndRedeemAfterDividendsAndASplit() public {
        vm.prank(alice);
        vault.split(100e18); // 99.9 base
        _dividend(1.01e18); // index 1.01
        _dividend(1.01e18); // index 1.0201
        _dividend(2e18); // 2:1 split → splitFactor 2, index unchanged
        vm.warp(maturity);
        assertEq(vault.state(), vault.STATE_MATURED());
        vm.expectRevert("Vault: not settled");
        vault.redeemPT(1);
        vault.settle();
        assertEq(vault.state(), vault.STATE_SETTLED());
        assertEq(vault.dm(), 1.0201e18);
        assertEq(vault.sm(), 2e18);

        uint256 treasuryBefore = stock.balanceOf(treasury);
        vm.startPrank(alice);
        uint256 ptOut = vault.redeemPT(99.9e18);
        uint256 ytOut = vault.redeemYT(99.9e18);
        vm.stopPrank();
        // PT: the share, post-split units: 99.9 × 2
        assertEq(ptOut, 199.8e18);
        // YT: dividends 2.01 % on those shares, less 5 %
        uint256 gross = 199.8e18 * 0.0201e18 / WAD;
        assertApproxEqAbs(ytOut, gross - gross * 500 / 10_000, 2);
        assertApproxEqAbs(stock.balanceOf(treasury) - treasuryBefore, gross * 500 / 10_000, 2);
        // conservation: PT + YT + fee == everything the deposit grew into
        assertApproxEqRel(ptOut + ytOut + (stock.balanceOf(treasury) - treasuryBefore), 99.9e18 * 2 * 1.0201e18 / WAD, 1e12);
        assertLe(vault.liabilities(), 10);
    }

    function test_settleWaitsForTheAccountant() public {
        stock.setUIMultiplier(1.0381e18);
        acct.sync();
        vm.warp(maturity);
        vm.expectRevert("Vault: accountant held");
        vault.settle();
        uint8 special = acct.KIND_SPECIAL();
        vm.warp(maturity + 2 days);
        vm.prank(guardian);
        acct.resolvePending(special);
        vault.settle();
        assertEq(vault.dm(), 1.0381e18);
    }

    function test_splitClosesAtMaturityButMergeStaysOpen() public {
        vm.prank(alice);
        vault.split(100e18);
        vm.warp(maturity);
        vm.prank(bob);
        vm.expectRevert("Vault: matured");
        vault.split(1e18);
        vm.prank(alice);
        assertEq(vault.merge(50e18), 50e18);
        vault.settle();
        vm.prank(alice);
        assertEq(vault.merge(49.9e18), 49.9e18); // merge after settlement pays the settled factor
    }

    function test_skimSendsOnlySurplus() public {
        vm.prank(alice);
        vault.split(100e18);
        assertEq(vault.skim(), 0);
        vm.warp(maturity);
        vault.settle();
        stock.setUIMultiplier(1.05e18); // post-maturity growth belongs to nobody but the treasury
        uint256 t = stock.balanceOf(treasury);
        uint256 s = vault.skim();
        assertApproxEqRel(s, 99.9e18 * 0.05e18 / WAD, 1e9);
        assertApproxEqAbs(stock.balanceOf(treasury) - t, s, 2); // the rebasing token floors the shares it moves
        // holders are still whole
        vm.prank(alice);
        assertEq(vault.redeemPT(99.9e18), 99.9e18);
    }

    function testFuzz_splitThenMergeIsLossless(uint96 amount) public {
        vm.assume(amount >= 1e12 && amount <= 1_000e18);
        vm.startPrank(alice);
        uint256 base = vault.split(amount);
        uint256 out = vault.merge(base);
        vm.stopPrank();
        uint256 fee = uint256(amount) * 10 / 10_000;
        assertApproxEqAbs(out, uint256(amount) - fee, 2);
    }
}
