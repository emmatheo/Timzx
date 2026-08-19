// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {BaseTest} from "./Base.t.sol";
import {TradeTypes} from "../src/TradeTypes.sol";
import {TradeFinance} from "../src/TradeFinance.sol";
import {RepaymentManager} from "../src/RepaymentManager.sol";

/// @notice The demo story, asserted end to end, plus the money movements it implies.
contract TradeLifecycleTest is BaseTest {
    function test_fullLifecycle_completesAndReturnsCollateral() public {
        uint256 supplierBefore = token.balanceOf(supplier);
        uint256 buyerBefore = token.balanceOf(buyer);
        uint256 financierBefore = token.balanceOf(financier);

        uint256 tradeId = _createTrade();
        assertEq(uint8(_stateOf(tradeId)), uint8(TradeTypes.TradeState.APPLICATION));

        vm.prank(owner);
        finance.verifySupplier(tradeId);
        assertEq(uint8(_stateOf(tradeId)), uint8(TradeTypes.TradeState.SUPPLIER_VERIFIED));

        vm.startPrank(buyer);
        token.approve(address(vault), COLLATERAL);
        finance.depositCollateral(tradeId);
        vm.stopPrank();
        assertEq(uint8(_stateOf(tradeId)), uint8(TradeTypes.TradeState.COLLATERAL_LOCKED));
        assertEq(vault.lockedOf(tradeId), COLLATERAL);

        vm.startPrank(financier);
        token.approve(address(escrow), FINANCING);
        finance.commitFinancing(tradeId);
        vm.stopPrank();
        assertEq(uint8(_stateOf(tradeId)), uint8(TradeTypes.TradeState.FINANCING_APPROVED));
        assertEq(escrow.heldOf(tradeId), FINANCING);
        // The supplier is not paid until the release step: escrow is not a pass-through.
        assertEq(token.balanceOf(supplier), supplierBefore);

        vm.prank(buyer);
        finance.releaseFunds(tradeId);
        assertEq(uint8(_stateOf(tradeId)), uint8(TradeTypes.TradeState.FUNDED));
        assertEq(token.balanceOf(supplier), supplierBefore + FINANCING);
        assertEq(escrow.heldOf(tradeId), 0);

        _advanceByProof(tradeId, TradeTypes.EventKind.SHIPMENT_CONFIRMED);
        assertEq(uint8(_stateOf(tradeId)), uint8(TradeTypes.TradeState.SHIPPED));

        _advanceByProof(tradeId, TradeTypes.EventKind.DELIVERY_CONFIRMED);
        assertEq(uint8(_stateOf(tradeId)), uint8(TradeTypes.TradeState.DELIVERED));

        uint256 due = FINANCING + (FINANCING * INTEREST_BPS) / 10_000;
        assertEq(finance.outstandingOf(tradeId), due);

        // Partial repayment first, to prove REPAYING is a real state and not skipped over.
        vm.startPrank(buyer);
        token.approve(address(repayments), due);
        finance.repay(tradeId, due / 2);
        assertEq(uint8(_stateOf(tradeId)), uint8(TradeTypes.TradeState.REPAYING));
        assertEq(finance.outstandingOf(tradeId), due - due / 2);

        finance.repay(tradeId, due - due / 2);
        vm.stopPrank();
        assertEq(uint8(_stateOf(tradeId)), uint8(TradeTypes.TradeState.REPAID));
        assertEq(finance.outstandingOf(tradeId), 0);

        finance.complete(tradeId);
        assertEq(uint8(_stateOf(tradeId)), uint8(TradeTypes.TradeState.COMPLETED));
        assertEq(vault.lockedOf(tradeId), 0);

        // Buyer paid principal + interest and got collateral back.
        assertEq(token.balanceOf(buyer), buyerBefore - due);
        // Financier is out the principal and up the interest.
        assertEq(token.balanceOf(financier), financierBefore - FINANCING + due);
        assertEq(token.balanceOf(supplier), supplierBefore + FINANCING);

        TradeFinance.CreditRecord memory rec = finance.creditRecordOf(buyer);
        assertEq(rec.tradesAsBuyer, 1);
        assertEq(rec.tradesCompleted, 1);
        assertEq(rec.tradesDefaulted, 0);
        assertEq(rec.volumeRepaid, due);
    }

    function test_overpaymentIsClampedToOutstanding() public {
        uint256 tradeId = _fundTrade();
        _advanceByProof(tradeId, TradeTypes.EventKind.SHIPMENT_CONFIRMED);
        _advanceByProof(tradeId, TradeTypes.EventKind.DELIVERY_CONFIRMED);

        uint256 due = finance.outstandingOf(tradeId);
        uint256 buyerBefore = token.balanceOf(buyer);

        vm.startPrank(buyer);
        token.approve(address(repayments), due * 2);
        finance.repay(tradeId, due * 2);
        vm.stopPrank();

        assertEq(finance.outstandingOf(tradeId), 0);
        // Only what was owed left the buyer's wallet.
        assertEq(token.balanceOf(buyer), buyerBefore - due);
    }

    function test_repayAfterSettlementReverts() public {
        uint256 tradeId = _fundTrade();
        _advanceByProof(tradeId, TradeTypes.EventKind.SHIPMENT_CONFIRMED);
        _advanceByProof(tradeId, TradeTypes.EventKind.DELIVERY_CONFIRMED);

        uint256 due = finance.outstandingOf(tradeId);
        vm.startPrank(buyer);
        token.approve(address(repayments), due * 2);
        finance.repay(tradeId, due);

        // State is REPAID, so the repay path is closed regardless of the manager's own guard.
        vm.expectRevert();
        finance.repay(tradeId, 1);
        vm.stopPrank();
    }

    function test_defaultSeizesCollateralAndReportsShortfall() public {
        uint256 tradeId = _fundTrade();
        _advanceByProof(tradeId, TradeTypes.EventKind.SHIPMENT_CONFIRMED);
        _advanceByProof(tradeId, TradeTypes.EventKind.DELIVERY_CONFIRMED);

        uint256 due = finance.outstandingOf(tradeId);
        uint256 financierBefore = token.balanceOf(financier);

        vm.warp(block.timestamp + uint256(TERM_DAYS) * 1 days + 1);

        vm.expectEmit(true, false, false, true);
        emit TradeFinance.TradeDefaulted(tradeId, COLLATERAL, due - COLLATERAL);
        vm.prank(financier);
        finance.declareDefault(tradeId);

        assertEq(uint8(_stateOf(tradeId)), uint8(TradeTypes.TradeState.DEFAULTED));
        assertEq(token.balanceOf(financier), financierBefore + COLLATERAL);
        assertEq(vault.lockedOf(tradeId), 0);
        assertEq(finance.creditRecordOf(buyer).tradesDefaulted, 1);
    }

    function test_defaultBeforeMaturityReverts() public {
        uint256 tradeId = _fundTrade();
        vm.prank(financier);
        vm.expectRevert();
        finance.declareDefault(tradeId);
    }

    function test_cancelRefundsCollateralAndEscrow() public {
        uint256 tradeId = _createTrade();
        vm.prank(owner);
        finance.verifySupplier(tradeId);

        vm.startPrank(buyer);
        token.approve(address(vault), COLLATERAL);
        finance.depositCollateral(tradeId);
        vm.stopPrank();

        vm.startPrank(financier);
        token.approve(address(escrow), FINANCING);
        finance.commitFinancing(tradeId);
        vm.stopPrank();

        uint256 buyerBefore = token.balanceOf(buyer);
        uint256 financierBefore = token.balanceOf(financier);

        vm.prank(buyer);
        finance.cancel(tradeId);

        assertEq(uint8(_stateOf(tradeId)), uint8(TradeTypes.TradeState.CANCELLED));
        assertEq(token.balanceOf(buyer), buyerBefore + COLLATERAL);
        assertEq(token.balanceOf(financier), financierBefore + FINANCING);
    }

    function test_cancelAfterFundingReverts() public {
        uint256 tradeId = _fundTrade();
        vm.prank(buyer);
        vm.expectRevert();
        finance.cancel(tradeId);
    }

    function test_interestMatchesSimpleFixedRate() public {
        uint256 tradeId = _fundTrade();
        RepaymentManager.Obligation memory o = repayments.obligationOf(tradeId);
        assertEq(o.principal, FINANCING);
        assertEq(o.totalDue, FINANCING + (FINANCING * INTEREST_BPS) / 10_000);
        assertEq(o.beneficiary, financier);
        assertEq(o.maturityAt, uint64(block.timestamp + uint256(TERM_DAYS) * 1 days));
    }
}
