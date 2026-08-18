// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title SettlementToken
/// @notice The ERC-20 that collateral, financing and repayment are denominated in.
///
/// @dev Deployed only on networks that have no established settlement stablecoin. Where one
///      exists, point the protocol at that token instead and do not deploy this: every module
///      takes the token address at construction, so nothing in the protocol depends on this
///      contract existing.
///
///      Six decimals rather than eighteen, matching the convention real settlement stablecoins
///      use, so on-chain amounts line up with the figures shown in the interface
///      (50000000000 == $50,000.00).
contract SettlementToken is ERC20, Ownable {
    /// @notice Accounts permitted to issue supply — the faucet on a test network, a treasury or
    ///         bridge contract elsewhere.
    /// @dev Separate from ownership so issuance can be delegated without handing over the
    ///      contract, and revoked without transferring it back.
    mapping(address => bool) public minters;

    event MinterSet(address indexed minter, bool allowed);

    error NotMinter(address caller);
    error ZeroAddress();

    constructor(string memory name_, string memory symbol_, address initialOwner)
        ERC20(name_, symbol_)
        Ownable(initialOwner)
    {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function setMinter(address minter, bool allowed) external onlyOwner {
        if (minter == address(0)) revert ZeroAddress();
        minters[minter] = allowed;
        emit MinterSet(minter, allowed);
    }

    /// @notice Issue supply to `to`.
    function mint(address to, uint256 amount) external {
        if (!minters[msg.sender] && msg.sender != owner()) revert NotMinter(msg.sender);
        _mint(to, amount);
    }

    /// @notice Destroy the caller's own supply.
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
}
