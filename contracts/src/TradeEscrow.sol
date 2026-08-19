// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {TradeTypes} from "./TradeTypes.sol";
import {ProtocolModule} from "./ProtocolModule.sol";

/// @title TradeEscrow
/// @notice Holds financier capital between commitment and disbursement to the supplier.
/// @dev The financier's money is committed before the supplier is paid, and the only two exits are
///      forward to the supplier or back to the financier. Neither the escrow owner nor the
///      financier can withdraw at will — the financier's protection is that release requires
///      TradeFinance to be in FINANCING_APPROVED, not that they hold a withdrawal key.
contract TradeEscrow is ProtocolModule, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Capital held per trade.
    mapping(uint256 => uint256) public heldOf;

    /// @notice Total capital held across all trades.
    uint256 public totalHeld;

    event FinancingDeposited(uint256 indexed tradeId, address indexed financier, uint256 amount);
    event FinancingReleased(uint256 indexed tradeId, address indexed supplier, uint256 amount);
    event FinancingRefunded(uint256 indexed tradeId, address indexed financier, uint256 amount);

    error AlreadyFunded(uint256 tradeId);
    error NothingHeld(uint256 tradeId);

    constructor(address initialOwner, address token_) ProtocolModule(initialOwner, token_) {}

    /// @notice Pull committed financing from `financier` and hold it against `tradeId`.
    function deposit(uint256 tradeId, address financier, uint256 amount)
        external
        onlyController
        nonReentrant
    {
        if (amount == 0) revert TradeTypes.ZeroAmount();
        if (heldOf[tradeId] != 0) revert AlreadyFunded(tradeId);

        heldOf[tradeId] = amount;
        totalHeld += amount;

        token.safeTransferFrom(financier, address(this), amount);
        emit FinancingDeposited(tradeId, financier, amount);
    }

    /// @notice Disburse held capital to the supplier.
    function releaseToSupplier(uint256 tradeId, address supplier)
        external
        onlyController
        nonReentrant
        returns (uint256 amount)
    {
        amount = _take(tradeId);
        token.safeTransfer(supplier, amount);
        emit FinancingReleased(tradeId, supplier, amount);
    }

    /// @notice Return held capital to the financier when a trade is cancelled before disbursement.
    function refund(uint256 tradeId, address financier)
        external
        onlyController
        nonReentrant
        returns (uint256 amount)
    {
        amount = _take(tradeId);
        token.safeTransfer(financier, amount);
        emit FinancingRefunded(tradeId, financier, amount);
    }

    function _take(uint256 tradeId) private returns (uint256 amount) {
        amount = heldOf[tradeId];
        if (amount == 0) revert NothingHeld(tradeId);
        heldOf[tradeId] = 0;
        totalHeld -= amount;
    }
}
