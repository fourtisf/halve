// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {WrappedStock} from "../src/WrappedStock.sol";
import {IStockToken} from "../src/interfaces/IStockToken.sol";

/// @notice One wrapper per stock token: the non-rebasing quote asset for the PT / YT pools. Env: STOCK, [OUT].
contract DeployWrappedStock is Script {
    function run() external {
        IStockToken stock = IStockToken(vm.envAddress("STOCK"));
        vm.startBroadcast();
        WrappedStock w = new WrappedStock(stock);
        vm.stopBroadcast();
        console2.log("wrappedStock", address(w));
        string memory json = vm.serializeAddress("w", "wrappedStock", address(w));
        vm.writeFile(vm.envOr("OUT", string("deployments/wrapped.json")), json);
    }
}
