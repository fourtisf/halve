// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "./ERC20.sol";

/// @notice Principal (pXXX) or yield (yXXX) token. Only its StripVault can mint and burn.
contract VaultToken is ERC20 {
    address public immutable vault;

    constructor(string memory _name, string memory _symbol, uint8 _decimals, address _vault) ERC20(_name, _symbol, _decimals) {
        vault = _vault;
    }

    modifier onlyVault() {
        require(msg.sender == vault, "VaultToken: vault only");
        _;
    }

    function mint(address to, uint256 amount) external onlyVault {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external onlyVault {
        _burn(from, amount);
    }
}
