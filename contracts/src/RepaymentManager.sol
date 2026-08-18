// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {TradeTypes} from "./TradeTypes.sol";
import {ProtocolModule} from "./ProtocolModule.sol";

/// @title RepaymentManager
/// @notice Tracks the buyer's obligation to the financier and settles repayments.
/// @dev Interest is simple and fixed at origination: `principal * interestBps / 10_000` over the
///      whole term, not per annum and not compounding. That is a deliberate MVP choice — the
///      lifecycle is what this protocol is proving, and an amortisation schedule would add
///      surface area without adding evidence. The shape (`open` / `repay` / `outstanding`) is
///      unchanged by a richer interest model, so it can be swapped in later.
contract RepaymentManager is ProtocolModule, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @param principal   Financed amount.
    /// @param totalDue    Principal plus fixed interest.
    /// @param repaid      Cumulative amount repaid.
    /// @param maturityAt  Timestamp after which the obligation may be declared in default.
    /// @param beneficiary Financier receiving repayments.
    /// @param opened      Distinguishes an open obligation from an unset one.
    struct Obligation {
        uint256 principal;
        uint256 totalDue;
        uint256 repaid;
        uint64 maturityAt;
        address beneficiary;
        bool opened;
    }

    uint256 internal constant BPS_DENOMINATOR = 10_000;

    mapping(uint256 => Obligation) internal _obligations;

    event ObligationOpened(
        uint256 indexed tradeId,
        address indexed beneficiary,
        uint256 principal,
        uint256 totalDue,
        uint64 maturityAt
    );
    event RepaymentReceived(
        uint256 indexed tradeId, address indexed payer, uint256 amount, uint256 outstanding
    );
    event ObligationSettled(uint256 indexed tradeId, uint256 totalRepaid);

    error ObligationNotOpen(uint256 tradeId);
    error ObligationAlreadyOpen(uint256 tradeId);
    error NothingOutstanding(uint256 tradeId);

    constructor(address initialOwner, address token_) ProtocolModule(initialOwner, token_) {}

    /// @notice Open the repayment obligation at the moment financing is disbursed.
    /// @param termDays Days from now until maturity.
    function open(
        uint256 tradeId,
        address beneficiary,
        uint256 principal,
        uint16 interestBps,
        uint16 termDays
    ) external onlyController returns (uint256 totalDue, uint64 maturityAt) {
        if (_obligations[tradeId].opened) revert ObligationAlreadyOpen(tradeId);
        if (principal == 0) revert TradeTypes.ZeroAmount();
        if (beneficiary == address(0)) revert TradeTypes.ZeroAddress();

        totalDue = principal + (principal * interestBps) / BPS_DENOMINATOR;
        maturityAt = uint64(block.timestamp + uint256(termDays) * 1 days);

        _obligations[tradeId] = Obligation({
            principal: principal,
            totalDue: totalDue,
            repaid: 0,
            maturityAt: maturityAt,
            beneficiary: beneficiary,
            opened: true
        });

        emit ObligationOpened(tradeId, beneficiary, principal, totalDue, maturityAt);
    }

    /// @notice Apply a repayment from the buyer and forward it to the financier.
    /// @dev Overpayment is impossible rather than refunded: an amount above the outstanding
    ///      balance is clamped down, so the buyer is never charged more than is owed and the
    ///      contract never holds a stray balance it would have to return.
    /// @return applied The amount actually taken from `payer`.
    /// @return outstandingAfter Remaining balance after this repayment.
    function repay(uint256 tradeId, address payer, uint256 amount)
        external
        onlyController
        nonReentrant
        returns (uint256 applied, uint256 outstandingAfter)
    {
        Obligation storage o = _obligations[tradeId];
        if (!o.opened) revert ObligationNotOpen(tradeId);
        if (amount == 0) revert TradeTypes.ZeroAmount();

        uint256 remaining = o.totalDue - o.repaid;
        if (remaining == 0) revert NothingOutstanding(tradeId);

        applied = amount > remaining ? remaining : amount;
        o.repaid += applied;
        outstandingAfter = o.totalDue - o.repaid;

        // Funds pass straight through to the financier; this contract never custodies repayments.
        token.safeTransferFrom(payer, o.beneficiary, applied);
        emit RepaymentReceived(tradeId, payer, applied, outstandingAfter);

        if (outstandingAfter == 0) emit ObligationSettled(tradeId, o.repaid);
    }

    /// @notice Remaining balance owed on `tradeId`.
    function outstanding(uint256 tradeId) external view returns (uint256) {
        Obligation storage o = _obligations[tradeId];
        if (!o.opened) return 0;
        return o.totalDue - o.repaid;
    }

    /// @notice Full obligation record for `tradeId`.
    function obligationOf(uint256 tradeId) external view returns (Obligation memory) {
        return _obligations[tradeId];
    }

    /// @notice Whether the obligation has passed maturity with a balance still outstanding.
    function isOverdue(uint256 tradeId) external view returns (bool) {
        Obligation storage o = _obligations[tradeId];
        if (!o.opened) return false;
        // Maturity is `termDays` away — 60 to 180 days in practice. The seconds of drift a
        // validator controls cannot move an obligation across that boundary.
        return block.timestamp > o.maturityAt && o.repaid < o.totalDue;
    }
}
