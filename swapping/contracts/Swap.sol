// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract TokenSwap is Ownable {
    // Store exchange rates between token pairs
    mapping(address => mapping(address => uint256)) public exchangeRates;

    // Events for setting exchange rates and performing swaps
    event RateSet(address indexed fromToken, address indexed toToken, uint256 rate);
    event Swap(address indexed user, address indexed fromToken, address indexed toToken, uint256 fromAmount, uint256 toAmount);

    constructor() Ownable(msg.sender) {}

    // Allows the owner to set exchange rates
    function setExchangeRate(address fromToken, address toToken, uint256 rate) external onlyOwner {
        require(rate > 0, "Rate must be positive");
        exchangeRates[fromToken][toToken] = rate;

        emit RateSet(fromToken, toToken, rate);
    }

    // Gets the exchange rate for a token pair
    function getExchangeRate(address fromToken, address toToken) public view returns (uint256) {
        return exchangeRates[fromToken][toToken];
    }

    // Main function to swap tokens
    function swap(address fromToken, address toToken, uint256 amount) external {
        require(amount > 0, "Amount must be positive");

        // Get exchange rate between tokens
        uint256 rate = getExchangeRate(fromToken, toToken);
        require(rate > 0, "Exchange rate not set");

        // Calculate the output amount of the `toToken`
        uint256 toAmount = (amount * rate) / 1e18;

        // Transfer the `fromToken` from the user to the contract
        IERC20(fromToken).transferFrom(msg.sender, address(this), amount);

        // Transfer the `toToken` from the contract to the user
        IERC20(toToken).transfer(msg.sender, toAmount);

        emit Swap(msg.sender, fromToken, toToken, amount, toAmount);
    }
}
