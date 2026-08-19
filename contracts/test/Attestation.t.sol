// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Vm} from "forge-std/Vm.sol";

import {BaseTest} from "./Base.t.sol";
import {TradeTypes} from "../src/TradeTypes.sol";
import {TradeFinance} from "../src/TradeFinance.sol";
import {BaseAttestationAdapter} from "../src/adapters/BaseAttestationAdapter.sol";
import {UscAttestationAdapter} from "../src/adapters/UscAttestationAdapter.sol";
import {IAttestationAdapter} from "../src/interfaces/IAttestationAdapter.sol";
import {NonProvingAdapter} from "./mocks/MockPrecompiles.sol";

/// @notice Tests for the verification seam.
/// @dev These cover the half of the problem the precompile does NOT solve. The precompile proves a
///      transaction was in an attested block; it says nothing about what the transaction contained
///      or which trade it concerns. Everything here is about that binding, and about the
///      protocol's refusal to act on anything it has not proved.
contract AttestationTest is BaseTest {
    // -----------------------------------------------------------------
    // Proof is the only accepted provenance
    // -----------------------------------------------------------------

    function test_adapterReportsUscProof() public view {
        assertEq(uint8(uscAdapter.proofKind()), uint8(TradeTypes.ProofKind.USC_PROOF));
    }

    function test_recordedAttestationIsProofBacked() public {
        uint256 tradeId = _fundTrade();
        bytes32 id =
            uscAdapter.submitProof(_validSubmission(tradeId, TradeTypes.EventKind.SHIPMENT_CONFIRMED));
        assertEq(uint8(uscAdapter.getAttestation(id).proofKind), uint8(TradeTypes.ProofKind.USC_PROOF));
    }

    /// @dev The protocol cannot be reconfigured into accepting unproved events: an adapter that
    ///      does not produce USC proofs is rejected at the point of installation.
    function test_cannotInstallNonProvingAdapter() public {
        NonProvingAdapter rogue = new NonProvingAdapter();
        vm.prank(owner);
        vm.expectRevert(TradeTypes.ProofRequired.selector);
        finance.setAttestationAdapter(IAttestationAdapter(address(rogue)));
    }

    function test_provedEventAdvancesTrade() public {
        uint256 tradeId = _fundTrade();
        _advanceByProof(tradeId, TradeTypes.EventKind.SHIPMENT_CONFIRMED);
        assertEq(uint8(_stateOf(tradeId)), uint8(TradeTypes.TradeState.SHIPPED));
    }

    // -----------------------------------------------------------------
    // Binding the proven bytes to the trade
    // -----------------------------------------------------------------

    function test_revertsWhenSourceTransactionReverted() public {
        uint256 tradeId = _fundTrade();
        UscAttestationAdapter.ProofSubmission memory s = _submission(
            tradeId,
            TradeTypes.EventKind.SHIPMENT_CONFIRMED,
            _encodedTx(0, address(emitter), _topicShipment(), tradeId)
        );
        vm.expectRevert(UscAttestationAdapter.SourceTransactionReverted.selector);
        uscAdapter.submitProof(s);
    }

    function test_revertsOnTopicMismatch() public {
        uint256 tradeId = _fundTrade();
        // A proof of some other event in the same block must not pass as a shipment confirmation.
        bytes32 wrongTopic = keccak256("Transfer(address,address,uint256)");
        UscAttestationAdapter.ProofSubmission memory s = _submission(
            tradeId,
            TradeTypes.EventKind.SHIPMENT_CONFIRMED,
            _encodedTx(1, address(emitter), wrongTopic, tradeId)
        );
        vm.expectRevert(
            abi.encodeWithSelector(UscAttestationAdapter.TopicMismatch.selector, _topicShipment(), wrongTopic)
        );
        uscAdapter.submitProof(s);
    }

    function test_revertsOnTradeIdMismatch() public {
        uint256 tradeId = _fundTrade();
        // A genuine shipment event for a different trade cannot be redirected onto this one.
        UscAttestationAdapter.ProofSubmission memory s = _submission(
            tradeId,
            TradeTypes.EventKind.SHIPMENT_CONFIRMED,
            _encodedTx(1, address(emitter), _topicShipment(), tradeId + 77)
        );
        vm.expectRevert(
            abi.encodeWithSelector(UscAttestationAdapter.TradeIdMismatch.selector, tradeId, tradeId + 77)
        );
        uscAdapter.submitProof(s);
    }

    function test_revertsOnUntrustedEmitter() public {
        uint256 tradeId = _fundTrade();
        address rogue = makeAddr("rogueEmitter");
        UscAttestationAdapter.ProofSubmission memory s = _submission(
            tradeId, TradeTypes.EventKind.SHIPMENT_CONFIRMED, _encodedTx(1, rogue, _topicShipment(), tradeId)
        );
        vm.expectRevert(
            abi.encodeWithSelector(BaseAttestationAdapter.UntrustedEmitter.selector, SEPOLIA_CHAIN_KEY, rogue)
        );
        uscAdapter.submitProof(s);
    }

    function test_revertsWhenInclusionProofFails() public {
        uint256 tradeId = _fundTrade();
        prover.setResult(false);
        vm.expectRevert(UscAttestationAdapter.InclusionProofFailed.selector);
        uscAdapter.submitProof(_validSubmission(tradeId, TradeTypes.EventKind.SHIPMENT_CONFIRMED));
    }

    function test_revertsWhenHeightNotAttested() public {
        uint256 tradeId = _fundTrade();
        UscAttestationAdapter.ProofSubmission memory s =
            _validSubmission(tradeId, TradeTypes.EventKind.SHIPMENT_CONFIRMED);
        s.sourceHeight = SOURCE_HEIGHT + 1; // never marked attested
        vm.expectRevert(
            abi.encodeWithSelector(
                UscAttestationAdapter.HeightNotAttested.selector, SEPOLIA_CHAIN_KEY, SOURCE_HEIGHT + 1
            )
        );
        uscAdapter.submitProof(s);
    }

    function test_revertsOnUnsupportedSourceChain() public {
        uint256 tradeId = _fundTrade();
        UscAttestationAdapter.ProofSubmission memory s =
            _validSubmission(tradeId, TradeTypes.EventKind.SHIPMENT_CONFIRMED);
        s.sourceChainKey = 99;
        vm.expectRevert(
            abi.encodeWithSelector(UscAttestationAdapter.UnsupportedSourceChain.selector, uint64(99))
        );
        uscAdapter.submitProof(s);
    }

    function test_revertsOnOutOfRangeFieldOffset() public {
        uint256 tradeId = _fundTrade();
        UscAttestationAdapter.ProofSubmission memory s =
            _validSubmission(tradeId, TradeTypes.EventKind.SHIPMENT_CONFIRMED);
        s.fields.tradeId = 4096; // past the end of the buffer
        vm.expectRevert();
        uscAdapter.submitProof(s);
    }

    // -----------------------------------------------------------------
    // Replay
    // -----------------------------------------------------------------

    function test_sameSourceLogCannotBeRecordedTwice() public {
        uint256 tradeId = _fundTrade();
        UscAttestationAdapter.ProofSubmission memory s =
            _validSubmission(tradeId, TradeTypes.EventKind.SHIPMENT_CONFIRMED);
        bytes32 id = uscAdapter.submitProof(s);

        vm.expectRevert(abi.encodeWithSelector(TradeTypes.AttestationReplayed.selector, id));
        uscAdapter.submitProof(s);
    }

    function test_sameAttestationCannotAdvanceTwice() public {
        uint256 tradeId = _fundTrade();
        bytes32 id = _advanceByProof(tradeId, TradeTypes.EventKind.SHIPMENT_CONFIRMED);

        vm.expectRevert(abi.encodeWithSelector(TradeFinance.AttestationAlreadyApplied.selector, id));
        finance.advanceWithAttestation(tradeId, id);
    }

    function test_attestationForAnotherTradeIsRejected() public {
        uint256 tradeA = _fundTrade();
        uint256 tradeB = _fundTrade();

        bytes32 id = uscAdapter.submitProof(_validSubmission(tradeB, TradeTypes.EventKind.SHIPMENT_CONFIRMED));

        vm.expectRevert(TradeTypes.AttestationMismatch.selector);
        finance.advanceWithAttestation(tradeA, id);
    }

    function test_unknownAttestationIsRejected() public {
        uint256 tradeId = _fundTrade();
        vm.expectRevert(TradeTypes.AttestationMismatch.selector);
        finance.advanceWithAttestation(tradeId, keccak256("never-recorded"));
    }

    // -----------------------------------------------------------------
    // Configuration
    // -----------------------------------------------------------------

    function test_unregisteredTopicIsRejected() public {
        uint256 tradeId = _fundTrade();
        // REPAYMENT_SETTLED is never registered in the fixture.
        UscAttestationAdapter.ProofSubmission memory s = _submission(
            tradeId,
            TradeTypes.EventKind.REPAYMENT_SETTLED,
            _encodedTx(1, address(emitter), _topicShipment(), tradeId)
        );
        vm.expectRevert(
            abi.encodeWithSelector(
                BaseAttestationAdapter.TopicNotRegistered.selector, TradeTypes.EventKind.REPAYMENT_SETTLED
            )
        );
        uscAdapter.submitProof(s);
    }

    function test_proofSubmissionIsPermissionless() public {
        uint256 tradeId = _fundTrade();
        // Anyone may submit a valid proof; validity, not identity, is what counts.
        vm.prank(outsider);
        bytes32 id =
            uscAdapter.submitProof(_validSubmission(tradeId, TradeTypes.EventKind.SHIPMENT_CONFIRMED));
        assertTrue(uscAdapter.isRecorded(id));
    }

    function test_topicRegistryIsOwnerOnly() public {
        vm.prank(outsider);
        vm.expectRevert();
        uscAdapter.registerTopic(TradeTypes.EventKind.SHIPMENT_CONFIRMED, keccak256("x"));
    }

    /// @dev The emitter's real event signature must match what the adapter expects. If someone
    ///      changes the event, this fails rather than silently rejecting every proof at runtime.
    function test_emitterEventSignatureMatchesRegisteredTopic() public {
        vm.recordLogs();
        vm.prank(owner);
        emitter.confirmShipment(1, keccak256("bol"));
        Vm.Log[] memory logs = vm.getRecordedLogs();
        assertEq(logs.length, 1);
        assertEq(logs[0].topics[0], _topicShipment());
        assertEq(uint256(logs[0].topics[1]), 1);
    }
}
