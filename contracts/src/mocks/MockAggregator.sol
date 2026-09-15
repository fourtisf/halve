// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Test double for a Chainlink AggregatorV3 USD feed (8 decimals).
contract MockAggregator {
    uint8 public constant decimals = 8;
    string public description;
    int256 public answer;
    uint80 public round = 1;

    constructor(string memory _description, int256 _answer) {
        description = _description;
        answer = _answer;
    }

    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        return (round, answer, block.timestamp, block.timestamp, round);
    }

    function setAnswer(int256 a) external {
        answer = a;
        round++;
    }
}
