// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice ERC-8056 tokenized stock: an ERC-20 whose balances are shares scaled by a UI multiplier that
/// grows with reinvested dividends and jumps on splits. Balances and amounts here are UI units.
interface IStockToken {
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    /// @notice Current multiplier, 1e18 = 1.0.
    function uiMultiplier() external view returns (uint256);
    /// @notice Scheduled multiplier (0 when none) and the timestamp it takes effect.
    function newUIMultiplier() external view returns (uint256);
    function effectiveAt() external view returns (uint256);
}
