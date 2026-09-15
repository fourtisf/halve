// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IStockToken} from "./interfaces/IStockToken.sol";

/// @title MultiplierAccountant
/// @notice One per stock token. Watches the token's UI multiplier and classifies every change by rule:
///   - growth of 0 < r <= 3 %            → dividend (dividendIndex *= r)
///   - clean small-integer ratio >= 20 % from 1 → split (splitFactor *= r)
///   - anything else                     → held for the guardian behind a public 2-day timelock
/// While something is held, `isSynced()` is false; consumers (StripVault, lending markets) pause on it.
/// A keeper can be late, never wrong: `sync()` is permissionless and idempotent.
contract MultiplierAccountant {
    uint256 public constant WAD = 1e18;
    uint256 public constant DIVIDEND_BAND = 3e16; // 3 %
    uint256 public constant SPLIT_MIN_DISTANCE = 2e17; // 20 %
    uint256 public constant SPLIT_TOLERANCE = 1e12; // 1e-6 of a unit, absorbs issuer rounding
    uint256 public constant TIMELOCK = 2 days;

    uint8 public constant KIND_DIVIDEND = 0;
    uint8 public constant KIND_SPLIT = 1;
    uint8 public constant KIND_SPECIAL = 2;

    struct Checkpoint {
        uint64 ts;
        uint8 kind;
        uint256 ratio; // multiplier ratio applied, WAD
        uint256 indexAfter; // dividendIndex after this checkpoint, WAD
    }

    struct Pending {
        bool exists;
        uint64 ts; // queued at; executable at ts + TIMELOCK
        uint256 oldMultiplier;
        uint256 newMultiplier;
    }

    IStockToken public immutable stock;
    address public guardian;
    uint256 public dividendIndex = WAD;
    uint256 public splitFactor = WAD;
    uint256 public lastMultiplier;
    Checkpoint[] private _checkpoints;
    Pending private _pending;

    event Synced(uint8 indexed kind, uint256 ratio, uint256 dividendIndex, uint256 splitFactor);
    event Held(uint256 oldMultiplier, uint256 newMultiplier, uint256 executableAt);
    event Resolved(uint8 indexed kind, uint256 ratio);
    event GuardianChanged(address indexed guardian);

    modifier onlyGuardian() {
        require(msg.sender == guardian, "Accountant: guardian only");
        _;
    }

    constructor(IStockToken _stock, address _guardian) {
        stock = _stock;
        guardian = _guardian;
        lastMultiplier = _stock.uiMultiplier();
        require(lastMultiplier > 0, "Accountant: zero multiplier");
    }

    // ---------------------------------------------------------------- reads

    function isSynced() external view returns (bool) {
        return !_pending.exists;
    }

    function pending() external view returns (bool exists, uint64 ts, uint256 oldMultiplier, uint256 newMultiplier) {
        Pending memory p = _pending;
        return (p.exists, p.ts, p.oldMultiplier, p.newMultiplier);
    }

    function checkpointCount() external view returns (uint256) {
        return _checkpoints.length;
    }

    function checkpointAt(uint256 i) external view returns (uint64 ts, uint8 kind, uint256 ratio, uint256 indexAfter) {
        Checkpoint memory c = _checkpoints[i];
        return (c.ts, c.kind, c.ratio, c.indexAfter);
    }

    /// @notice dividendIndex as of `ts`: the index after the last checkpoint at or before `ts`.
    function dividendIndexAt(uint256 ts) external view returns (uint256) {
        uint256 n = _checkpoints.length;
        if (n == 0 || _checkpoints[0].ts > ts) return WAD;
        uint256 lo = 0;
        uint256 hi = n - 1;
        while (lo < hi) {
            uint256 mid = (lo + hi + 1) / 2;
            if (_checkpoints[mid].ts <= ts) lo = mid;
            else hi = mid - 1;
        }
        return _checkpoints[lo].indexAfter;
    }

    /// @notice How the current multiplier change would be classified, for UIs and keepers.
    function classify(uint256 ratio) public pure returns (uint8 kind, bool auto_) {
        if (ratio > WAD && ratio - WAD <= DIVIDEND_BAND) return (KIND_DIVIDEND, true);
        uint256 distance = ratio > WAD ? ratio - WAD : WAD - ratio;
        if (distance >= SPLIT_MIN_DISTANCE && _isCleanRatio(ratio)) return (KIND_SPLIT, true);
        return (ratio > WAD ? KIND_SPECIAL : KIND_SPLIT, false);
    }

    // --------------------------------------------------------------- writes

    /// @notice Pull the token's multiplier and classify the change. Permissionless.
    function sync() external {
        require(!_pending.exists, "Accountant: held");
        uint256 m = stock.uiMultiplier();
        if (m == lastMultiplier) return;
        uint256 ratio = (m * WAD) / lastMultiplier;
        (uint8 kind, bool auto_) = classify(ratio);
        if (!auto_) {
            _pending = Pending({exists: true, ts: uint64(block.timestamp), oldMultiplier: lastMultiplier, newMultiplier: m});
            emit Held(lastMultiplier, m, block.timestamp + TIMELOCK);
            return;
        }
        _apply(kind, ratio, m);
    }

    /// @notice Guardian resolves a held change after the timelock as a special dividend or a split.
    function resolvePending(uint8 kind) external onlyGuardian {
        Pending memory p = _pending;
        require(p.exists, "Accountant: nothing pending");
        require(block.timestamp >= p.ts + TIMELOCK, "Accountant: timelock");
        require(kind == KIND_SPECIAL || kind == KIND_SPLIT, "Accountant: bad kind");
        uint256 ratio = (p.newMultiplier * WAD) / p.oldMultiplier;
        delete _pending;
        _apply(kind, ratio, p.newMultiplier);
        emit Resolved(kind, ratio);
    }

    function setGuardian(address g) external onlyGuardian {
        guardian = g;
        emit GuardianChanged(g);
    }

    // ------------------------------------------------------------- internal

    function _apply(uint8 kind, uint256 ratio, uint256 newMultiplier) internal {
        if (kind == KIND_SPLIT) splitFactor = (splitFactor * ratio) / WAD;
        else dividendIndex = (dividendIndex * ratio) / WAD;
        lastMultiplier = newMultiplier;
        _checkpoints.push(Checkpoint({ts: uint64(block.timestamp), kind: kind, ratio: ratio, indexAfter: dividendIndex}));
        emit Synced(kind, ratio, dividendIndex, splitFactor);
    }

    /// @dev ratio ≈ p/q with q in 1..20 and p in 1..100 (2:1, 3:2, 1:4 reverse, ...).
    function _isCleanRatio(uint256 ratio) internal pure returns (bool) {
        for (uint256 q = 1; q <= 20; q++) {
            uint256 scaled = ratio * q;
            uint256 p = (scaled + WAD / 2) / WAD;
            if (p == 0 || p > 100) continue;
            uint256 target = p * WAD;
            uint256 diff = scaled > target ? scaled - target : target - scaled;
            if (diff <= SPLIT_TOLERANCE * q) return true;
        }
        return false;
    }
}
