// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {StripVault} from "../src/StripVault.sol";
import {MultiplierAccountant} from "../src/MultiplierAccountant.sol";
import {IStockToken} from "../src/interfaces/IStockToken.sol";
import {MockStockToken} from "../src/mocks/MockStockToken.sol";

/// Raw-unit accounting: the stock token's balances never move, only its uiMultiplier does.
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
        assertEq(vault.principalPerPT(), WAD);
    }

    function test_splitTakesTenBpsAndMintsBothHalves() public {
        vm.prank(alice);
        uint256 base = vault.split(100e18);
        assertEq(base, 99.9e18);
        assertEq(vault.pt().balanceOf(alice), 99.9e18);
        assertEq(vault.yt().balanceOf(alice), 99.9e18);
        assertEq(stock.balanceOf(treasury), 0.1e18);
        assertEq(vault.totalDeposits(), 99.9e18);
        assertEq(stock.balanceOf(address(vault)), 99.9e18);
    }

    function test_mergeIsFreeAndReturnsTheRawTokens() public {
        vm.startPrank(alice);
        vault.split(100e18);
        uint256 before = stock.balanceOf(alice);
        uint256 out = vault.merge(99.9e18);
        vm.stopPrank();
        assertEq(out, 99.9e18);
        assertEq(stock.balanceOf(alice) - before, 99.9e18);
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

    function test_ownerCanHandOverButNeverToZero() public {
        vm.prank(owner);
        vm.expectRevert("Vault: zero");
        vault.setOwner(address(0));
        vm.prank(owner);
        vault.setOwner(bob);
        assertEq(vault.owner(), bob);
        vm.prank(owner);
        vm.expectRevert("Vault: owner only");
        vault.setCap(1);
        vm.prank(bob);
        vault.setTreasury(alice);
        assertEq(vault.treasury(), alice);
    }

    function test_dividendsDoNotMoveRawBalancesButMoveTheIndex() public {
        vm.prank(alice);
        vault.split(100e18);
        _dividend(1.0065e18);
        assertEq(stock.balanceOf(address(vault)), 99.9e18); // raw balance untouched
        assertEq(stock.uiAmount(address(vault)), 99.9e18 * 1.0065e18 / WAD); // but it now represents more shares
        assertApproxEqRel(vault.principalPerPT(), WAD * WAD / 1.0065e18, 1e12);
        // a later depositor gets base units 1:1 in raw terms, dividends are not a discount on raw
        vm.prank(bob);
        assertEq(vault.split(100e18), 99.9e18);
        // merge still pays raw 1:1, which is worth the grown share count
        vm.prank(alice);
        assertEq(vault.merge(99.9e18), 99.9e18);
        assertLe(vault.liabilities(), stock.balanceOf(address(vault)));
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
        assertEq(vault.merge(10e18), 10e18);
    }

    function test_settleAndRedeemAfterDividendsAndASplit() public {
        vm.prank(alice);
        vault.split(100e18); // 99.9 base
        _dividend(1.01e18); // index 1.01
        _dividend(1.01e18); // index 1.0201
        _dividend(2e18); // 2:1 split → splitFactor 2, index unchanged, raw balances unchanged
        vm.warp(maturity);
        assertEq(vault.state(), vault.STATE_MATURED());
        vm.expectRevert("Vault: not settled");
        vault.redeemPT(1);
        vault.settle();
        assertEq(vault.state(), vault.STATE_SETTLED());
        assertEq(vault.dm(), 1.0201e18);

        uint256 treasuryBefore = stock.balanceOf(treasury);
        vm.startPrank(alice);
        uint256 ptOut = vault.redeemPT(99.9e18);
        uint256 ytOut = vault.redeemYT(99.9e18);
        vm.stopPrank();
        // PT: the original share count, i.e. raw × d0/dm (the split does not change raw units at all)
        assertApproxEqRel(ptOut, 99.9e18 * WAD / 1.0201e18, 1e12);
        // YT: the reinvested dividends, raw × (dm − d0)/dm, less 5 %
        uint256 gross = 99.9e18 - ptOut;
        assertApproxEqAbs(ytOut, gross - gross * 500 / 10_000, 2);
        assertApproxEqAbs(stock.balanceOf(treasury) - treasuryBefore, gross * 500 / 10_000, 2);
        // conservation: PT + YT + fee == exactly the raw tokens deposited
        assertApproxEqAbs(ptOut + ytOut + (stock.balanceOf(treasury) - treasuryBefore), 99.9e18, 2);
        assertLe(vault.liabilities(), 2);
        assertLe(stock.balanceOf(address(vault)), 2);
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
        assertEq(vault.merge(49.9e18), 49.9e18); // merge after settlement still pays raw 1:1
    }

    function test_skimSendsOnlySurplus() public {
        vm.prank(alice);
        vault.split(100e18);
        assertEq(vault.skim(), 0);
        stock.setUIMultiplier(1.05e18); // dividends change nothing in raw terms: no surplus appears
        assertEq(vault.skim(), 0);
        stock.mint(address(vault), 3e18); // a donation is surplus
        uint256 t = stock.balanceOf(treasury);
        assertEq(vault.skim(), 3e18);
        assertEq(stock.balanceOf(treasury) - t, 3e18);
        vm.prank(alice);
        assertEq(vault.merge(99.9e18), 99.9e18); // holders are still whole
    }

    function testFuzz_splitThenMergeIsLossless(uint96 amount) public {
        vm.assume(amount >= 1e12 && amount <= 1_000e18);
        vm.startPrank(alice);
        uint256 base = vault.split(amount);
        uint256 out = vault.merge(base);
        vm.stopPrank();
        assertEq(out, uint256(amount) - uint256(amount) * 10 / 10_000);
    }

    function testFuzz_redemptionConservesRawTokens(uint64 growthBps, uint96 amount) public {
        vm.assume(amount >= 1e12 && amount <= 1_000e18);
        vm.prank(alice);
        uint256 base = vault.split(amount);
        stock.setUIMultiplier(1e18 + (uint256(growthBps) % 300) * 1e14); // 0 – 3 %: a dividend
        acct.sync();
        vm.warp(maturity);
        vault.settle();
        uint256 t = stock.balanceOf(treasury);
        vm.startPrank(alice);
        uint256 p = vault.redeemPT(base);
        uint256 y = vault.redeemYT(base);
        vm.stopPrank();
        assertApproxEqAbs(p + y + (stock.balanceOf(treasury) - t), base, 4);
        assertLe(stock.balanceOf(address(vault)), 4);
    }
}
