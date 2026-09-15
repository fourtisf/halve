// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "./ERC20.sol";

/// @notice $HALVE. Fixed supply of 1,000,000,000 minted once to the treasury. No emissions, no minter.
/// Buyback & burn happens through `burn`, which any holder (the treasury included) can call.
contract HalveToken is ERC20 {
    uint256 public constant SUPPLY = 1_000_000_000e18;
    uint256 public burned;

    event Burn(address indexed from, uint256 amount);

    constructor(address treasury) ERC20("Halve", "HALVE", 18) {
        _mint(treasury, SUPPLY);
    }

    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
        burned += amount;
        emit Burn(msg.sender, amount);
    }
}
