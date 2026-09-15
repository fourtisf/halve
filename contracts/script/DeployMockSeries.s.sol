// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {StripVault} from "../src/StripVault.sol";
import {MultiplierAccountant} from "../src/MultiplierAccountant.sol";
import {IStockToken} from "../src/interfaces/IStockToken.sol";
import {MockStockToken} from "../src/mocks/MockStockToken.sol";
import {MockV3Pool} from "../src/mocks/MockV3Pool.sol";
import {MockAggregator} from "../src/mocks/MockAggregator.sol";

/// @notice Local / testnet fixture: a mock stock token, one series, mock pools priced in the stock and a
/// mock USD feed. Writes the addresses as JSON to OUT (default series.local.json) in series.json shape.
/// Env: [TICKER=JEPI] [PRICE_USD_8=5710000000] [MATURITY] [FUND=address to mint 1000 stock to] [OUT]
contract DeployMockSeries is Script {
    uint256 constant Q96 = 2 ** 96;
    uint256 constant WAD = 1e18;

    struct Deployed {
        MockStockToken stock;
        MultiplierAccountant acct;
        StripVault vault;
        MockV3Pool poolPT;
        MockV3Pool poolYT;
        MockAggregator feed;
    }

    function run() external {
        string memory ticker = vm.envOr("TICKER", string("JEPI"));
        uint256 maturity = vm.envOr("MATURITY", block.timestamp + 180 days);
        Deployed memory d = _deploy(ticker, maturity);
        string memory json = _json(ticker, d, maturity);
        vm.writeFile(vm.envOr("OUT", string("series.local.json")), json);
        console2.log(json);
    }

    function _deploy(string memory ticker, uint256 maturity) internal returns (Deployed memory d) {
        int256 priceUsd8 = int256(vm.envOr("PRICE_USD_8", uint256(5_710_000_000)));
        address fund = vm.envOr("FUND", address(0));
        address deployer = msg.sender;

        vm.startBroadcast();
        d.stock = new MockStockToken(string.concat("Mock ", ticker), ticker);
        d.acct = new MultiplierAccountant(IStockToken(address(d.stock)), deployer);
        d.vault = new StripVault(IStockToken(address(d.stock)), d.acct, ticker, maturity, 1_000_000e18, deployer, deployer);
        // PT at 0.96 stock, YT at 0.04 stock (sqrtPriceX96 of token1/token0 — orientation by address order)
        d.poolPT = new MockV3Pool(address(d.vault.pt()), address(d.stock), _sqrt(address(d.vault.pt()), address(d.stock), 0.96e18));
        d.poolYT = new MockV3Pool(address(d.vault.yt()), address(d.stock), _sqrt(address(d.vault.yt()), address(d.stock), 0.04e18));
        d.feed = new MockAggregator(string.concat(ticker, " / USD"), priceUsd8);
        d.stock.mint(deployer, 1_000_000e18);
        if (fund != address(0)) d.stock.mint(fund, 1_000e18);
        vm.stopBroadcast();
    }

    /// @dev series.json-shaped record, built with the serialize cheatcodes to keep the stack shallow.
    function _json(string memory ticker, Deployed memory d, uint256 maturity) internal returns (string memory out) {
        string memory k = "series";
        vm.serializeString(k, "id", string.concat(ticker, "-LOCAL"));
        vm.serializeString(k, "ticker", ticker);
        vm.serializeString(k, "name", string.concat("Mock ", ticker));
        vm.serializeString(k, "issuer", "Robinhood");
        vm.serializeAddress(k, "underlying", address(d.stock));
        vm.serializeAddress(k, "vault", address(d.vault));
        vm.serializeAddress(k, "pt", address(d.vault.pt()));
        vm.serializeAddress(k, "yt", address(d.vault.yt()));
        vm.serializeAddress(k, "accountant", address(d.acct));
        vm.serializeAddress(k, "poolPT", address(d.poolPT));
        vm.serializeAddress(k, "poolYT", address(d.poolYT));
        vm.serializeAddress(k, "priceFeed", address(d.feed));
        vm.serializeUint(k, "maturity", maturity);
        vm.serializeString(k, "cap", "1000000000000000000000000");
        vm.serializeUint(k, "decimals", 18);
        out = vm.serializeString(k, "schedule", "monthly");
    }

    /// @dev sqrtPriceX96 for `priceTokenInStock` (WAD) given Uniswap's token ordering.
    function _sqrt(address token, address stock, uint256 priceTokenInStock) internal pure returns (uint160) {
        // price1per0 = token1 / token0. If token is token0: price = stock per token = priceTokenInStock.
        // If token is token1: price = token per stock = 1 / priceTokenInStock.
        uint256 p = token < stock ? priceTokenInStock : (WAD * WAD) / priceTokenInStock;
        // sqrt(p) * 2^96, with p in WAD: sqrt(p / 1e18) * 2^96 = sqrt(p * 1e18) * 2^96 / 1e18
        return uint160((_isqrt(p * WAD) * Q96) / WAD);
    }

    function _isqrt(uint256 x) internal pure returns (uint256 y) {
        if (x == 0) return 0;
        uint256 z = (x + 1) / 2;
        y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
    }
}
