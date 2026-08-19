// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {TradeTypes} from "./TradeTypes.sol";
import {ProtocolModule} from "./ProtocolModule.sol";

/// @title CollateralVault
/// @notice Custodies buyer collateral for the life of a trade.
/// @dev Collateral has exactly three possible endings — released to the buyer on completion,
///      seized by the financier on default, or refunded on cancellation — and each is reachable
///      only from the corresponding TradeFinance transition. There is no owner withdrawal path;
///      the owner can bind the controller and nothing else.
contract CollateralVault is ProtocolModule, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Collateral currently locked per trade.
    mapping(uint256 => uint256) public lockedOf;

    /// @notice Total collateral held across all trades.
    /// @dev Tracked independently of `token.balanceOf(this)` so that tokens transferred in
    ///      directly cannot be mistaken for collateral.
    uint256 public totalLocked;

    event CollateralLocked(uint256 indexed tradeId, address indexed from, uint256 amount);
    event CollateralReleased(uint256 indexed tradeId, address indexed to, uint256 amount);
    event CollateralSeized(uint256 indexed tradeId, address indexed to, uint256 amount);

    error AlreadyLocked(uint256 tradeId);
    error NothingLocked(uint256 tradeId);

    constructor(address initialOwner, address token_) ProtocolModule(initialOwner, token_) {}

    /// @notice Pull `amount` of collateral from `from` and lock it against `tradeId`.
    /// @dev `from` must have approved this vault. Requiring approval to the vault rather than to
    ///      TradeFinance keeps the token allowance scoped to the contract that actually custodies
    ///      the funds.
    function lock(uint256 tradeId, address from, uint256 amount) external onlyController nonReentrant {
        if (amount == 0) revert TradeTypes.ZeroAmount();
        if (lockedOf[tradeId] != 0) revert AlreadyLocked(tradeId);

        lockedOf[tradeId] = amount;
        totalLocked += amount;

        token.safeTransferFrom(from, address(this), amount);
        emit CollateralLocked(tradeId, from, amount);
    }

    /// @notice Return collateral to the buyer after successful completion or cancellation.
    function release(uint256 tradeId, address to) external onlyController nonReentrant {
        uint256 amount = _take(tradeId);
        token.safeTransfer(to, amount);
        emit CollateralReleased(tradeId, to, amount);
    }

    /// @notice Transfer collateral to the financier after a default.
    function seize(uint256 tradeId, address to) external onlyController nonReentrant {
        uint256 amount = _take(tradeId);
        token.safeTransfer(to, amount);
        emit CollateralSeized(tradeId, to, amount);
    }

    /// @dev Clears the trade's position and returns what was held. Zeroing before transfer means a
    ///      second call finds nothing to take, independently of the reentrancy guard.
    function _take(uint256 tradeId) private returns (uint256 amount) {
        amount = lockedOf[tradeId];
        if (amount == 0) revert NothingLocked(tradeId);
        lockedOf[tradeId] = 0;
        totalLocked -= amount;
    }
}
