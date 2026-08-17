// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title TestUSD
/// @notice Six-decimal testnet settlement token standing in for a trade-settlement stablecoin.
/// @dev TESTNET ONLY, with no value. Six decimals rather than eighteen so that amounts on-chain
///      match the amounts shown in the UI (50000000000 == $50,000.00) and so the codebase is
///      exercised against the decimal convention real settlement stablecoins actually use.
contract TestUSD is ERC20, Ownable {
    constructor(address initialOwner) ERC20("TImx Test USD", "tUSD") Ownable(initialOwner) {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
