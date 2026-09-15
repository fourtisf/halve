// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IStockToken} from "./interfaces/IStockToken.sol";
import {MultiplierAccountant} from "./MultiplierAccountant.sol";
import {VaultToken} from "./VaultToken.sol";

/// @title StripVault
/// @notice Splits a Robinhood Chain stock token into a principal token (the share) and a yield token (the
/// dividends until maturity). The stock token follows ERC-8056: raw balances never change, corporate actions
/// only move `uiMultiplier` (one raw token = uiMultiplier shares). PT and YT are therefore denominated in
/// raw token units, and the vault holds exactly the raw tokens deposited.
///
///   split(amount)  : amount raw in → fee 0.10 % → base PT + base YT, base = amount − fee
///   merge(base)    : base PT + base YT → base raw. Free. Works in every state. Never gated.
///   settle()       : after maturity, once the accountant is synced; freezes dm = dividendIndex.
///   redeemPT(base) : base × d0 / dm raw   — the share with the reinvested dividends removed (splits cancel out)
///   redeemYT(base) : base × (dm − d0) / dm raw, less the 5 % yield fee — the reinvested dividends
///
/// d0 / dm are the accountant's dividendIndex at series start / settlement (1e18 = 1.0); the accountant keeps
/// splits out of that index, so PT redeems its original share count and YT the growth on top of it.
contract StripVault {
    uint256 public constant WAD = 1e18;
    uint256 public constant SPLIT_FEE_BPS = 10; // 0.10 %
    uint256 public constant YIELD_FEE_BPS = 500; // 5 %

    /// @notice If the accountant is still holding a change this long after maturity (guardian absent), anyone
    /// may settle on the index as it stands: the held change then goes to PT holders, but nobody is locked out.
    uint256 public constant FORCE_SETTLE_DELAY = 30 days;

    uint8 public constant STATE_ACTIVE = 0;
    uint8 public constant STATE_MATURED = 1;
    uint8 public constant STATE_SETTLED = 2;

    IStockToken public immutable stock;
    MultiplierAccountant public immutable accountant;
    VaultToken public immutable pt;
    VaultToken public immutable yt;
    uint256 public immutable maturity;
    uint256 public immutable d0; // dividendIndex at series start

    address public owner; // may only change cap, treasury and itself — never touches user funds
    address public treasury;
    uint256 public cap; // max base units outstanding (raw token units)
    bool public settled;
    uint256 public dm; // dividendIndex at settlement

    event Split(address indexed account, uint256 amount, uint256 fee, uint256 base);
    event Merge(address indexed account, uint256 base, uint256 amount);
    event Settled(uint256 dm);
    event RedeemPT(address indexed account, uint256 base, uint256 amount);
    event RedeemYT(address indexed account, uint256 base, uint256 amount, uint256 fee);
    event CapChanged(uint256 cap);
    event TreasuryChanged(address treasury);
    event OwnerChanged(address owner);

    modifier onlyOwner() {
        require(msg.sender == owner, "Vault: owner only");
        _;
    }

    uint256 private _entered;

    /// @dev The stock token is an upgradeable contract we do not control; never let it re-enter a state change.
    modifier nonReentrant() {
        require(_entered == 0, "Vault: reentrancy");
        _entered = 1;
        _;
        _entered = 0;
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
        // d0 is copied from the accountant: it must reflect the token as it is today, not a change still waiting
        require(_accountant.isSynced(), "Vault: accountant held");
        require(_accountant.lastMultiplier() == _stock.uiMultiplier(), "Vault: accountant stale");
        require(_maturity > block.timestamp, "Vault: maturity in the past");
        require(_treasury != address(0) && _owner != address(0), "Vault: zero");
        stock = _stock;
        accountant = _accountant;
        maturity = _maturity;
        cap = _cap;
        treasury = _treasury;
        owner = _owner;
        d0 = _accountant.dividendIndex();
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

    /// @notice Raw tokens one PT redeems for right now (WAD): d0 / dividendIndex, i.e. the share without the
    /// dividends reinvested so far. Frozen at settlement. Capped at 1.0: if the index ever fell below d0 (a
    /// negative adjustment the guardian resolved as special), PT keeps the whole raw unit and YT gets nothing.
    function principalPerPT() public view returns (uint256) {
        uint256 d = settled ? dm : accountant.dividendIndex();
        if (d <= d0) return WAD;
        return (d0 * WAD) / d;
    }

    /// @notice Raw tokens owed to holders; anything above it in the vault is surplus.
    function liabilities() public view returns (uint256) {
        if (!settled) return pt.totalSupply();
        uint256 ppp = principalPerPT();
        return (pt.totalSupply() * ppp) / WAD + (yt.totalSupply() * (WAD - ppp)) / WAD;
    }

    // --------------------------------------------------------------- writes

    /// @notice Deposit `amount` raw tokens. Paused only while the accountant holds a change.
    function split(uint256 amount) external nonReentrant returns (uint256 base) {
        require(state() == STATE_ACTIVE, "Vault: matured");
        require(accountant.isSynced(), "Vault: accountant held");
        require(amount > 0, "Vault: zero");
        uint256 before = stock.balanceOf(address(this));
        require(stock.transferFrom(msg.sender, address(this), amount), "Vault: transferFrom");
        uint256 received = stock.balanceOf(address(this)) - before;
        uint256 fee = (received * SPLIT_FEE_BPS) / 10_000;
        if (fee > 0) require(stock.transfer(treasury, fee), "Vault: fee");
        base = received - fee;
        require(base > 0, "Vault: dust");
        require(pt.totalSupply() + base <= cap, "Vault: cap");
        pt.mint(msg.sender, base);
        yt.mint(msg.sender, base);
        emit Split(msg.sender, received, fee, base);
    }

    /// @notice Burn `base` PT and `base` YT for the raw tokens they represent. Free, in every state.
    function merge(uint256 base) external nonReentrant returns (uint256 amount) {
        require(base > 0, "Vault: zero");
        pt.burn(msg.sender, base);
        yt.burn(msg.sender, base);
        amount = _pay(msg.sender, base);
        emit Merge(msg.sender, base, amount);
    }

    /// @notice Anyone may settle once matured. The token's latest multiplier is pulled into the index first, so
    /// the last dividend before maturity goes to YT holders whoever calls first (a stale index would hand it to
    /// PT). A change that needs the guardian blocks settlement until it is resolved, or until FORCE_SETTLE_DELAY
    /// has passed and the guardian's own window on it has run out.
    function settle() external nonReentrant {
        require(!settled, "Vault: settled");
        require(block.timestamp >= maturity, "Vault: not matured");
        bool forced = block.timestamp >= maturity + FORCE_SETTLE_DELAY;
        if (accountant.isSynced()) {
            if (forced) {
                try accountant.sync() {} catch {} // a token that cannot even be read must not lock funds forever
            } else {
                accountant.sync();
            }
        }
        if (!accountant.isSynced()) {
            require(forced, "Vault: accountant held");
            (, uint64 heldAt,,) = accountant.pending();
            require(block.timestamp >= heldAt + accountant.TIMELOCK(), "Vault: guardian window");
        }
        dm = accountant.dividendIndex();
        settled = true;
        emit Settled(dm);
    }

    function redeemPT(uint256 base) external nonReentrant returns (uint256 amount) {
        require(settled, "Vault: not settled");
        require(base > 0, "Vault: zero");
        pt.burn(msg.sender, base);
        amount = _pay(msg.sender, (base * principalPerPT()) / WAD);
        emit RedeemPT(msg.sender, base, amount);
    }

    function redeemYT(uint256 base) external nonReentrant returns (uint256 amount) {
        require(settled, "Vault: not settled");
        require(base > 0, "Vault: zero");
        yt.burn(msg.sender, base);
        uint256 gross = (base * (WAD - principalPerPT())) / WAD;
        uint256 fee = (gross * YIELD_FEE_BPS) / 10_000;
        if (fee > 0) fee = _pay(treasury, fee);
        amount = _pay(msg.sender, gross - fee);
        emit RedeemYT(msg.sender, base, amount, fee);
    }

    /// @notice Send raw tokens above liabilities (donations, rounding dust) to the treasury.
    function skim() external nonReentrant returns (uint256 surplus) {
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

    /// @notice Hand the (cap / treasury only) owner role to another address, e.g. a multisig after launch.
    function setOwner(address o) external onlyOwner {
        require(o != address(0), "Vault: zero");
        owner = o;
        emit OwnerChanged(o);
    }

    /// @dev Pays `amount`, clamped to the vault balance. The vault holds exactly the raw tokens deposited, so the
    /// clamp can only bite on rounding dust; anything larger means the issuer moved the vault's tokens, and then
    /// burning a holder's PT / YT for less than owed is the wrong outcome, so it reverts instead.
    function _pay(address to, uint256 amount) internal returns (uint256 paid) {
        uint256 bal = stock.balanceOf(address(this));
        require(amount <= bal + 2, "Vault: shortfall");
        paid = amount > bal ? bal : amount;
        if (paid > 0) require(stock.transfer(to, paid), "Vault: transfer");
    }
}
