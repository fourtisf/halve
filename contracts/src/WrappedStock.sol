// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "./ERC20.sol";
import {IStockToken} from "./interfaces/IStockToken.sol";

/// @title WrappedStock
/// @notice Non-rebasing wrapper around an ERC-8056 stock token, like wstETH around stETH. One wStock is one
/// share; its stock value is `shares × uiMultiplier`. Use it as the quote asset of the PT / YT pools:
/// Uniswap v3 does not support rebasing tokens (positive rebases get stuck in the pool), and PT + YT is a
/// constant number of shares, so prices quoted in wStock do not drift with every dividend.
contract WrappedStock is ERC20 {
    uint256 public constant WAD = 1e18;
    IStockToken public immutable stock;

    event Wrap(address indexed account, uint256 amount, uint256 shares);
    event Unwrap(address indexed account, uint256 shares, uint256 amount);

    constructor(IStockToken _stock)
        ERC20(string.concat("Wrapped ", _stock.name()), string.concat("w", _stock.symbol()), _stock.decimals())
    {
        stock = _stock;
    }

    /// @notice Stock UI units per wStock (WAD) right now.
    function stockPerShare() external view returns (uint256) {
        return stock.uiMultiplier();
    }

    function sharesFor(uint256 amount) public view returns (uint256) {
        return (amount * WAD) / stock.uiMultiplier();
    }

    function amountFor(uint256 shares) public view returns (uint256) {
        return (shares * stock.uiMultiplier()) / WAD;
    }

    /// @notice Deposit `amount` stock (UI units), receive the shares it represents. Rounds down.
    function wrap(uint256 amount) external returns (uint256 shares) {
        require(amount > 0, "wStock: zero");
        uint256 before = stock.balanceOf(address(this));
        require(stock.transferFrom(msg.sender, address(this), amount), "wStock: transferFrom");
        uint256 received = stock.balanceOf(address(this)) - before;
        shares = sharesFor(received);
        require(shares > 0, "wStock: dust");
        _mint(msg.sender, shares);
        emit Wrap(msg.sender, received, shares);
    }

    /// @notice Burn `shares`, receive their current stock value (UI units), clamped to the balance for rounding dust.
    function unwrap(uint256 shares) external returns (uint256 amount) {
        require(shares > 0, "wStock: zero");
        _burn(msg.sender, shares);
        amount = amountFor(shares);
        uint256 bal = stock.balanceOf(address(this));
        if (amount > bal) amount = bal;
        require(stock.transfer(msg.sender, amount), "wStock: transfer");
        emit Unwrap(msg.sender, shares, amount);
    }
}
