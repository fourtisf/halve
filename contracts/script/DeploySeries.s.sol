// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {StripVault} from "../src/StripVault.sol";
import {MultiplierAccountant} from "../src/MultiplierAccountant.sol";
import {IStockToken} from "../src/interfaces/IStockToken.sol";

/// @notice Deploys one series (accountant + vault + PT/YT) for an existing ERC-8056 stock token.
/// Env: STOCK, TICKER, MATURITY (unix), CAP (base units, 1e18), TREASURY, GUARDIAN, OWNER, [ACCOUNTANT to reuse],
///      [PRICE_FEED] [OUT=deployments/series.json] (series.json-shaped record for scripts/apply-deployment.mjs).
///   forge script script/DeploySeries.s.sol --rpc-url $RPC --broadcast --private-key $PK
contract DeploySeries is Script {
    function run() external {
        IStockToken stock = IStockToken(vm.envAddress("STOCK"));
        address existing = vm.envOr("ACCOUNTANT", address(0));
        vm.startBroadcast();
        MultiplierAccountant acct =
            existing == address(0) ? new MultiplierAccountant(stock, vm.envAddress("GUARDIAN")) : MultiplierAccountant(existing);
        StripVault vault = new StripVault(
            stock, acct, vm.envString("TICKER"), vm.envUint("MATURITY"), vm.envUint("CAP"), vm.envAddress("TREASURY"), vm.envAddress("OWNER")
        );
        vm.stopBroadcast();
        console2.log("underlying ", address(stock));
        console2.log("accountant ", address(acct));
        console2.log("vault      ", address(vault));
        console2.log("pt         ", address(vault.pt()));
        console2.log("yt         ", address(vault.yt()));
        string memory k = "series";
        vm.serializeAddress(k, "underlying", address(stock));
        vm.serializeAddress(k, "accountant", address(acct));
        vm.serializeAddress(k, "vault", address(vault));
        vm.serializeAddress(k, "pt", address(vault.pt()));
        vm.serializeAddress(k, "yt", address(vault.yt()));
        vm.serializeUint(k, "maturity", vault.maturity());
        vm.serializeString(k, "cap", vm.toString(vault.cap()));
        vm.serializeUint(k, "decimals", stock.decimals());
        vm.serializeUint(k, "deployBlock", block.number);
        string memory json = vm.serializeAddress(k, "priceFeed", vm.envOr("PRICE_FEED", address(0)));
        vm.writeFile(vm.envOr("OUT", string("deployments/series.json")), json);
    }
}
