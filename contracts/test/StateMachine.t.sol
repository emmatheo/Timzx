// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {BaseTest} from "./Base.t.sol";
import {TradeTypes} from "../src/TradeTypes.sol";
import {TradeFinance} from "../src/TradeFinance.sol";
import {CollateralVault} from "../src/CollateralVault.sol";
import {ProtocolModule} from "../src/ProtocolModule.sol";

/// @notice Every way a trade could be pushed out of sequence, asserted to fail.
/// @dev The point of the enum-based state machine is that these are not merely discouraged; each
///      one reverts at the contract boundary, so no frontend bug or hostile caller can produce a
///      trade in an incoherent state.
contract StateMachineTest is BaseTest {
    function test_cannotDepositCollateralBeforeSupplierVerified() public {
        uint256 tradeId = _createTrade();
        vm.startPrank(buyer);
        token.approve(address(vault), COLLATERAL);
        vm.expectRevert(
            abi.encodeWithSelector(
                TradeTypes.InvalidState.selector,
                tradeId,
                TradeTypes.TradeState.APPLICATION,
                TradeTypes.TradeState.SUPPLIER_VERIFIED
            )
        );
        finance.depositCollateral(tradeId);
        vm.stopPrank();
    }

    function test_cannotFinanceBeforeCollateralLocked() public {
        uint256 tradeId = _createTrade();
        vm.prank(owner);
        finance.verifySupplier(tradeId);

        vm.startPrank(financier);
        token.approve(address(escrow), FINANCING);
        vm.expectRevert();
        finance.commitFinancing(tradeId);
        vm.stopPrank();
    }

    function test_cannotReleaseFundsBeforeFinancingApproved() public {
        uint256 tradeId = _createTrade();
        vm.prank(buyer);
        vm.expectRevert();
        finance.releaseFunds(tradeId);
    }

    function test_cannotSkipShipmentAndGoStraightToDelivery() public {
        uint256 tradeId = _fundTrade();
        // A genuinely proved delivery event still cannot skip the shipment step: the proof
        // establishes that the event happened, the state machine decides whether it may apply.
        bytes32 id =
            uscAdapter.submitProof(_validSubmission(tradeId, TradeTypes.EventKind.DELIVERY_CONFIRMED));
        vm.expectRevert(
            abi.encodeWithSelector(
                TradeTypes.InvalidState.selector,
                tradeId,
                TradeTypes.TradeState.FUNDED,
                TradeTypes.TradeState.SHIPPED
            )
        );
        finance.advanceWithAttestation(tradeId, id);
    }

    function test_cannotRepayBeforeDelivery() public {
        uint256 tradeId = _fundTrade();
        _advanceByProof(tradeId, TradeTypes.EventKind.SHIPMENT_CONFIRMED);

        vm.startPrank(buyer);
        token.approve(address(repayments), FINANCING);
        vm.expectRevert();
        finance.repay(tradeId, 1000 * USD);
        vm.stopPrank();
    }

    function test_cannotCompleteBeforeRepaid() public {
        uint256 tradeId = _fundTrade();
        _advanceByProof(tradeId, TradeTypes.EventKind.SHIPMENT_CONFIRMED);
        _advanceByProof(tradeId, TradeTypes.EventKind.DELIVERY_CONFIRMED);

        vm.expectRevert();
        finance.complete(tradeId);
        // Collateral is untouched by the failed attempt.
        assertEq(vault.lockedOf(tradeId), COLLATERAL);
    }

    function test_collateralCannotBeReleasedBeforeCompletion() public {
        uint256 tradeId = _fundTrade();
        // Only the controller can move collateral, and it only does so on valid transitions.
        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSelector(ProtocolModule.NotController.selector, buyer));
        vault.release(tradeId, buyer);
    }

    function test_onlyBuyerCanDepositCollateral() public {
        uint256 tradeId = _createTrade();
        vm.prank(owner);
        finance.verifySupplier(tradeId);

        vm.startPrank(outsider);
        token.approve(address(vault), COLLATERAL);
        vm.expectRevert(
            abi.encodeWithSelector(
                TradeTypes.NotAuthorized.selector, tradeId, outsider, TradeTypes.Party.BUYER
            )
        );
        finance.depositCollateral(tradeId);
        vm.stopPrank();
    }

    function test_onlyBuyerCanRepay() public {
        uint256 tradeId = _fundTrade();
        _advanceByProof(tradeId, TradeTypes.EventKind.SHIPMENT_CONFIRMED);
        _advanceByProof(tradeId, TradeTypes.EventKind.DELIVERY_CONFIRMED);

        vm.startPrank(outsider);
        vm.expectRevert();
        finance.repay(tradeId, 1000 * USD);
        vm.stopPrank();
    }

    function test_supplierCannotTriggerOwnPayment() public {
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

        vm.prank(supplier);
        vm.expectRevert();
        finance.releaseFunds(tradeId);
    }

    function test_buyerCannotFinanceOwnTrade() public {
        uint256 tradeId = _createTrade();
        vm.prank(owner);
        finance.verifySupplier(tradeId);
        vm.startPrank(buyer);
        token.approve(address(vault), COLLATERAL);
        finance.depositCollateral(tradeId);
        token.approve(address(escrow), FINANCING);
        vm.expectRevert(TradeFinance.SelfFinancingForbidden.selector);
        finance.commitFinancing(tradeId);
        vm.stopPrank();
    }

    function test_collateralMustBeBelowTradeValue() public {
        vm.startPrank(buyer);
        vm.expectRevert(TradeTypes.InvalidTerms.selector);
        finance.createTrade(supplier, TRADE_VALUE, TRADE_VALUE, INTEREST_BPS, TERM_DAYS, bytes32(0));

        vm.expectRevert(TradeTypes.InvalidTerms.selector);
        finance.createTrade(supplier, TRADE_VALUE, 0, INTEREST_BPS, TERM_DAYS, bytes32(0));
        vm.stopPrank();
    }

    function test_buyerCannotBeOwnSupplier() public {
        vm.prank(buyer);
        vm.expectRevert(TradeFinance.InvalidCounterparty.selector);
        finance.createTrade(buyer, TRADE_VALUE, COLLATERAL, INTEREST_BPS, TERM_DAYS, bytes32(0));
    }

    function test_unknownTradeReverts() public {
        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSelector(TradeTypes.UnknownTrade.selector, uint256(999)));
        finance.depositCollateral(999);
    }

    function test_collateralCannotBeLockedTwice() public {
        uint256 tradeId = _createTrade();
        vm.prank(owner);
        finance.verifySupplier(tradeId);
        vm.startPrank(buyer);
        token.approve(address(vault), COLLATERAL * 2);
        finance.depositCollateral(tradeId);
        // State has moved on, so a second deposit is rejected before the vault is even reached.
        vm.expectRevert();
        finance.depositCollateral(tradeId);
        vm.stopPrank();
    }
}
