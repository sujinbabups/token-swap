// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract TokenSwap is Ownable {
    mapping(address => mapping(address => uint256)) public exchangeRates;

    event RateSet(address indexed fromToken, address indexed toToken, uint256 rate);
    event Swap(address indexed user, address indexed fromToken, address indexed toToken, uint256 fromAmount, uint256 toAmount);

    constructor() Ownable(msg.sender) {}

    function setExchangeRate(address fromToken, address toToken, uint256 rate) external onlyOwner {
        require(rate > 0, "Rate must be positive");
        exchangeRates[fromToken][toToken] = rate;
        emit RateSet(fromToken, toToken, rate);
    }

    function getExchangeRate(address fromToken, address toToken) public view returns (uint256) {
        return exchangeRates[fromToken][toToken];
    }

    function swap(address fromToken, address toToken, uint256 amount) external {
        require(amount > 0, "Amount must be positive");
        uint256 rate = getExchangeRate(fromToken, toToken);
        require(rate > 0, "Exchange rate not set");

        // Calculate the amount of `toToken` to send based on the rate
        uint256 toAmount = (amount * rate) / 1e18;

        // Check allowance
        uint256 allowance = IERC20(fromToken).allowance(msg.sender, address(this));
        require(allowance >= amount, "Token allowance too low");

        // Transfer tokens from user to contract
        IERC20(fromToken).transferFrom(msg.sender, address(this), amount);
        // Transfer `toToken` from contract to user
        IERC20(toToken).transfer(msg.sender, toAmount);

        emit Swap(msg.sender, fromToken, toToken, amount, toAmount);
    }

    function withdrawToken(address token, uint256 amount) external onlyOwner {
        IERC20(token).transfer(owner(), amount);
    }
}
