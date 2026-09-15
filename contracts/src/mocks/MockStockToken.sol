// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Test double for an ERC-8056 stock token: balances are shares × uiMultiplier. The owner moves
/// the multiplier to simulate dividends (small growth) and splits (integer ratios).
contract MockStockToken {
    uint256 public constant WAD = 1e18;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    string public name;
    string public symbol;
    uint8 public constant decimals = 18;
    address public owner;
    uint256 public uiMultiplier = WAD;
    uint256 public newUIMultiplier;
    uint256 public effectiveAt;
    uint256 public totalShares;
    mapping(address => uint256) public shares;
    mapping(address => mapping(address => uint256)) public allowance;

    constructor(string memory _name, string memory _symbol) {
        name = _name;
        symbol = _symbol;
        owner = msg.sender;
    }

    function totalSupply() external view returns (uint256) {
        return (totalShares * uiMultiplier) / WAD;
    }

    function balanceOf(address a) public view returns (uint256) {
        return (shares[a] * uiMultiplier) / WAD;
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

    /// @notice Owner-only: mint `amount` UI units.
    function mint(address to, uint256 amount) external {
        require(msg.sender == owner, "owner");
        uint256 s = (amount * WAD) / uiMultiplier;
        shares[to] += s;
        totalShares += s;
        emit Transfer(address(0), to, amount);
    }

    /// @notice Owner-only: simulate a dividend reinvestment or a split by moving the multiplier.
    function setUIMultiplier(uint256 m) external {
        require(msg.sender == owner, "owner");
        uiMultiplier = m;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        uint256 s = (amount * WAD) / uiMultiplier; // floor, like stETH: the sender never over-pays by a share
        require(shares[from] >= s, "balance");
        shares[from] -= s;
        shares[to] += s;
        emit Transfer(from, to, amount);
    }
}
