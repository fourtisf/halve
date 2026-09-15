// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Test double for a Robinhood Chain stock token (ERC-20 + ERC-8056 "scaled UI amount"). Raw balances
/// and totalSupply never change; corporate actions only move `uiMultiplier`, and wallets display
/// `balanceOf × uiMultiplier` shares. The owner moves the multiplier to simulate reinvested dividends
/// (small growth) and splits (integer ratios).
contract MockStockToken {
    uint256 public constant WAD = 1e18;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event UIMultiplierUpdated(uint256 oldMultiplier, uint256 newMultiplier);

    string public name;
    string public symbol;
    uint8 public constant decimals = 18;
    address public owner;
    uint256 public uiMultiplier = WAD;
    uint256 public newUIMultiplier;
    uint256 public effectiveAt;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    constructor(string memory _name, string memory _symbol) {
        name = _name;
        symbol = _symbol;
        owner = msg.sender;
    }

    /// @notice Shares represented by an account's raw balance (what wallets display).
    function uiAmount(address a) external view returns (uint256) {
        return (balanceOf[a] * uiMultiplier) / WAD;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            require(allowed >= amount, "allowance");
            allowance[from][msg.sender] = allowed - amount;
        }
        _transfer(from, to, amount);
        return true;
    }

    /// @notice Owner-only: mint `amount` raw units.
    function mint(address to, uint256 amount) external {
        require(msg.sender == owner, "owner");
        balanceOf[to] += amount;
        totalSupply += amount;
        emit Transfer(address(0), to, amount);
    }

    /// @notice Owner-only: simulate a dividend reinvestment or a split. Raw balances stay put.
    function setUIMultiplier(uint256 m) external {
        require(msg.sender == owner, "owner");
        emit UIMultiplierUpdated(uiMultiplier, m);
        uiMultiplier = m;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(balanceOf[from] >= amount, "balance");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }
}
