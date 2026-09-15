// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {StripVault} from "../src/StripVault.sol";
import {MultiplierAccountant} from "../src/MultiplierAccountant.sol";
import {IStockToken} from "../src/interfaces/IStockToken.sol";

/// @notice Deploys one series (accountant + vault + PT/YT) for an existing ERC-8056 stock token.
/// Env: STOCK, TICKER, MATURITY (unix), CAP (base units, 1e18), TREASURY, GUARDIAN, OWNER, [ACCOUNTANT to reuse].
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
    }
}
