// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {HalveToken} from "../src/HalveToken.sol";

/// @notice Env: TREASURY. Mints the full 1B supply to it.
contract DeployHalveToken is Script {
    function run() external {
        vm.startBroadcast();
        HalveToken t = new HalveToken(vm.envAddress("TREASURY"));
        vm.stopBroadcast();
        console2.log("HALVE", address(t));
    }
}
