// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title TestnetFaucet
/// @notice Dispenses the testnet settlement token so a wallet can walk the trade lifecycle.
/// @dev TESTNET ONLY. Cooldown state is on-chain so the UI reads the real remaining time from the
///      chain rather than tracking it locally — a page reload or a different browser cannot
///      produce a different answer than the contract will give.
contract TestnetFaucet is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;

    /// @notice Amount dispensed per request, in token units.
    uint256 public dripAmount;

    /// @notice Seconds a wallet must wait between requests.
    uint64 public cooldown;

    /// @notice Timestamp of each wallet's last successful request.
    mapping(address => uint64) public lastRequestAt;

    event Dripped(address indexed to, uint256 amount);
    event ConfigChanged(uint256 dripAmount, uint64 cooldown);
    event Funded(address indexed from, uint256 amount);

    error CooldownActive(uint64 availableAt);
    error FaucetEmpty(uint256 requested, uint256 available);

    constructor(address initialOwner, address token_, uint256 dripAmount_, uint64 cooldown_)
        Ownable(initialOwner)
    {
        token = IERC20(token_);
        dripAmount = dripAmount_;
        cooldown = cooldown_;
        emit ConfigChanged(dripAmount_, cooldown_);
    }

    /// @notice Timestamp at which `account` may next request, or 0 if it may request now.
    function availableAt(address account) public view returns (uint64) {
        uint64 last = lastRequestAt[account];
        if (last == 0) return 0;
        uint64 next = last + cooldown;
        return next > block.timestamp ? next : 0;
    }

    /// @notice Request the drip amount for the calling wallet.
    function request() external nonReentrant returns (uint256 amount) {
        uint64 next = availableAt(msg.sender);
        if (next != 0) revert CooldownActive(next);

        amount = dripAmount;
        uint256 balance = token.balanceOf(address(this));
        if (balance < amount) revert FaucetEmpty(amount, balance);

        lastRequestAt[msg.sender] = uint64(block.timestamp);
        token.safeTransfer(msg.sender, amount);
        emit Dripped(msg.sender, amount);
    }

    /// @notice Top up the faucet. Anyone may fund it.
    function fund(uint256 amount) external {
        token.safeTransferFrom(msg.sender, address(this), amount);
        emit Funded(msg.sender, amount);
    }

    function setConfig(uint256 dripAmount_, uint64 cooldown_) external onlyOwner {
        dripAmount = dripAmount_;
        cooldown = cooldown_;
        emit ConfigChanged(dripAmount_, cooldown_);
    }

    /// @notice Recover unused testnet funds.
    function sweep(address to, uint256 amount) external onlyOwner {
        token.safeTransfer(to, amount);
    }
}
