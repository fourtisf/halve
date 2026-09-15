// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IStockToken} from "./interfaces/IStockToken.sol";
import {MultiplierAccountant} from "./MultiplierAccountant.sol";
import {VaultToken} from "./VaultToken.sol";

/// @title StripVault
/// @notice Splits a rebasing stock token into a principal token (the share) and a yield token (the
/// dividends until maturity). PT and YT are denominated in *base units*: one base unit is one share as
/// it stood when the series started (dividend index d0, split factor s0).
///
///   split(amount)  : amount stock in → fee 0.10 % → base = net / factor() → base PT + base YT
///   merge(base)    : base PT + base YT → base × factor() stock. Free. Works in every state. Never gated.
///   settle()       : after maturity, once the accountant is synced; freezes dm / sm.
///   redeemPT(base) : base × (sm / s0) stock — the share, dividends removed
///   redeemYT(base) : base × (sm / s0) × (dm / d0 − 1) stock, less the 5 % yield fee — the dividends
///
/// factor() = (dividendIndex / d0) × (splitFactor / s0): stock UI units per base unit right now.
/// The vault holds exactly the shares deposited; the token's own rebasing keeps it fully backed.
contract StripVault {
    uint256 public constant WAD = 1e18;
    uint256 public constant SPLIT_FEE_BPS = 10; // 0.10 %
    uint256 public constant YIELD_FEE_BPS = 500; // 5 %

    uint8 public constant STATE_ACTIVE = 0;
    uint8 public constant STATE_MATURED = 1;
    uint8 public constant STATE_SETTLED = 2;

    IStockToken public immutable stock;
    MultiplierAccountant public immutable accountant;
    VaultToken public immutable pt;
    VaultToken public immutable yt;
    uint256 public immutable maturity;
    uint256 public immutable d0; // dividendIndex at series start
    uint256 public immutable s0; // splitFactor at series start

    address public owner; // may only change cap and treasury — never touches user funds
    address public treasury;
    uint256 public cap; // max base units outstanding
    bool public settled;
    uint256 public dm; // dividendIndex at settlement
    uint256 public sm; // splitFactor at settlement

    event Split(address indexed account, uint256 amount, uint256 fee, uint256 base);
    event Merge(address indexed account, uint256 base, uint256 amount);
    event Settled(uint256 dm, uint256 sm);
    event RedeemPT(address indexed account, uint256 base, uint256 amount);
    event RedeemYT(address indexed account, uint256 base, uint256 amount, uint256 fee);
    event CapChanged(uint256 cap);
    event TreasuryChanged(address treasury);

    modifier onlyOwner() {
        require(msg.sender == owner, "Vault: owner only");
        _;
    }

    constructor(
        IStockToken _stock,
        MultiplierAccountant _accountant,
        string memory ticker,
        uint256 _maturity,
        uint256 _cap,
        address _treasury,
        address _owner
    ) {
        require(address(_accountant.stock()) == address(_stock), "Vault: accountant mismatch");
        require(_maturity > block.timestamp, "Vault: maturity in the past");
        stock = _stock;
        accountant = _accountant;
        maturity = _maturity;
        cap = _cap;
        treasury = _treasury;
        owner = _owner;
        d0 = _accountant.dividendIndex();
        s0 = _accountant.splitFactor();
        uint8 dec = _stock.decimals();
        pt = new VaultToken(string.concat("Halve Principal ", ticker), string.concat("p", ticker), dec, address(this));
        yt = new VaultToken(string.concat("Halve Yield ", ticker), string.concat("y", ticker), dec, address(this));
    }

    // ---------------------------------------------------------------- reads

    function totalDeposits() external view returns (uint256) {
        return pt.totalSupply();
    }

    function state() public view returns (uint8) {
        if (settled) return STATE_SETTLED;
        if (block.timestamp >= maturity) return STATE_MATURED;
        return STATE_ACTIVE;
    }

    /// @notice Stock UI units per base unit right now (WAD).
    function factor() public view returns (uint256) {
        if (settled) return _factor(dm, sm);
        return _factor(accountant.dividendIndex(), accountant.splitFactor());
    }

    /// @notice Stock owed to holders at current prices; anything above it in the vault is surplus.
    function liabilities() public view returns (uint256) {
        if (!settled) return (pt.totalSupply() * factor()) / WAD;
        uint256 splitAdj = (sm * WAD) / s0;
        uint256 ptOwed = (pt.totalSupply() * splitAdj) / WAD;
        uint256 ytOwed = (((yt.totalSupply() * splitAdj) / WAD) * ((dm * WAD) / d0 - WAD)) / WAD;
        return ptOwed + ytOwed;
    }

    // --------------------------------------------------------------- writes

    /// @notice Deposit `amount` stock (UI units). Paused only while the accountant holds a change.
    function split(uint256 amount) external returns (uint256 base) {
        require(state() == STATE_ACTIVE, "Vault: matured");
        require(accountant.isSynced(), "Vault: accountant held");
        require(amount > 0, "Vault: zero");
        require(stock.transferFrom(msg.sender, address(this), amount), "Vault: transferFrom");
        uint256 fee = (amount * SPLIT_FEE_BPS) / 10_000;
        if (fee > 0) require(stock.transfer(treasury, fee), "Vault: fee");
        uint256 net = amount - fee;
        base = (net * WAD) / factor();
        require(base > 0, "Vault: dust");
        require(pt.totalSupply() + base <= cap, "Vault: cap");
        pt.mint(msg.sender, base);
        yt.mint(msg.sender, base);
        emit Split(msg.sender, amount, fee, base);
    }

    /// @notice Burn `base` PT and `base` YT for the stock they represent. Free, in every state.
    function merge(uint256 base) external returns (uint256 amount) {
        require(base > 0, "Vault: zero");
        pt.burn(msg.sender, base);
        yt.burn(msg.sender, base);
        amount = _pay(msg.sender, (base * factor()) / WAD);
        emit Merge(msg.sender, base, amount);
    }

    /// @notice Anyone may settle once matured and the accountant has nothing held.
    function settle() external {
        require(!settled, "Vault: settled");
        require(block.timestamp >= maturity, "Vault: not matured");
        require(accountant.isSynced(), "Vault: accountant held");
        dm = accountant.dividendIndex();
        sm = accountant.splitFactor();
        settled = true;
        emit Settled(dm, sm);
    }

    function redeemPT(uint256 base) external returns (uint256 amount) {
        require(settled, "Vault: not settled");
        require(base > 0, "Vault: zero");
        pt.burn(msg.sender, base);
        amount = _pay(msg.sender, (base * ((sm * WAD) / s0)) / WAD);
        emit RedeemPT(msg.sender, base, amount);
    }

    function redeemYT(uint256 base) external returns (uint256 amount) {
        require(settled, "Vault: not settled");
        require(base > 0, "Vault: zero");
        yt.burn(msg.sender, base);
        uint256 gross = (((base * ((sm * WAD) / s0)) / WAD) * ((dm * WAD) / d0 - WAD)) / WAD;
        uint256 fee = (gross * YIELD_FEE_BPS) / 10_000;
        if (fee > 0) fee = _pay(treasury, fee);
        amount = _pay(msg.sender, gross - fee);
        emit RedeemYT(msg.sender, base, amount, fee);
    }

    /// @notice Send stock above liabilities (post-maturity rebasing, rounding dust) to the treasury.
    function skim() external returns (uint256 surplus) {
        uint256 bal = stock.balanceOf(address(this));
        uint256 owed = liabilities();
        surplus = bal > owed ? bal - owed : 0;
        if (surplus > 0) require(stock.transfer(treasury, surplus), "Vault: transfer");
    }

    function setCap(uint256 c) external onlyOwner {
        cap = c;
        emit CapChanged(c);
    }

    function setTreasury(address t) external onlyOwner {
        require(t != address(0), "Vault: zero");
        treasury = t;
        emit TreasuryChanged(t);
    }

    function _factor(uint256 D, uint256 S) internal view returns (uint256) {
        return (((D * WAD) / d0) * S) / s0;
    }

    /// @dev Pays `amount` stock, clamped to the vault balance. The vault holds exactly the shares that were
    /// deposited, so the clamp can only ever bite on rounding dust in the rebasing token's own maths.
    function _pay(address to, uint256 amount) internal returns (uint256 paid) {
        uint256 bal = stock.balanceOf(address(this));
        paid = amount > bal ? bal : amount;
        if (paid > 0) require(stock.transfer(to, paid), "Vault: transfer");
    }
}
