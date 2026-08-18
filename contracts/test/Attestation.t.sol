// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Vm} from "forge-std/Vm.sol";

import {BaseTest} from "./Base.t.sol";
import {TradeTypes} from "../src/TradeTypes.sol";
import {TradeFinance} from "../src/TradeFinance.sol";
import {BaseAttestationAdapter} from "../src/adapters/BaseAttestationAdapter.sol";
import {UscAttestationAdapter} from "../src/adapters/UscAttestationAdapter.sol";
import {DemoAttestationAdapter} from "../src/adapters/DemoAttestationAdapter.sol";
import {IAttestationAdapter} from "../src/interfaces/IAttestationAdapter.sol";
import {INativeQueryVerifier} from "../src/interfaces/INativeQueryVerifier.sol";

/// @notice Tests for the verification seam.
/// @dev These cover the half of the problem the precompile does NOT solve. The precompile proves
///      that a transaction was in an attested block; it says nothing about what the transaction
///      contained or which trade it concerns. Everything asserted here is about that binding —
///      and about the protocol's refusal to treat an unproved assertion as a proof.
contract AttestationTest is BaseTest {
    // Layout of the synthetic encoded-transaction buffer used in these tests. In production these
    // offsets come from `QueryBuilder.build()` in the SDK, computed against the real encoding.
    uint32 internal constant OFF_RX_STATUS = 0;
    uint32 internal constant OFF_LOG_ADDRESS = 32;
    uint32 internal constant OFF_TOPIC0 = 64;
    uint32 internal constant OFF_TRADE_ID = 96;

    function _fields() internal pure returns (UscAttestationAdapter.QueryFields memory) {
        return UscAttestationAdapter.QueryFields({
            rxStatus: OFF_RX_STATUS, logAddress: OFF_LOG_ADDRESS, topic0: OFF_TOPIC0, tradeId: OFF_TRADE_ID
        });
    }

    /// @dev Builds the buffer the adapter will read after inclusion is proved.
    function _encodedTx(uint256 rxStatus, address logAddress, bytes32 topic0, uint256 tradeId)
        internal
        pure
        returns (bytes memory)
    {
        return abi.encode(rxStatus, uint256(uint160(logAddress)), topic0, tradeId);
    }

    function _submission(uint256 tradeId, TradeTypes.EventKind kind, bytes memory encoded)
        internal
        pure
        returns (UscAttestationAdapter.ProofSubmission memory s)
    {
        s.tradeId = tradeId;
        s.kind = kind;
        s.sourceChainKey = SEPOLIA_CHAIN_KEY;
        s.sourceHeight = SOURCE_HEIGHT;
        s.sourceTxHash = keccak256(abi.encode("source-tx", tradeId, kind));
        s.logIndex = 0;
        s.encodedTransaction = encoded;
        s.merkleProof = INativeQueryVerifier.MerkleProof({
            root: keccak256("root"), siblings: new INativeQueryVerifier.MerkleProofEntry[](0)
        });
        s.continuityProof = INativeQueryVerifier.ContinuityProof({
            lowerEndpointDigest: keccak256("lower"), roots: new bytes32[](0)
        });
        s.fields = _fields();
    }

    function _validSubmission(uint256 tradeId)
        internal
        view
        returns (UscAttestationAdapter.ProofSubmission memory)
    {
        return _submission(
            tradeId,
            TradeTypes.EventKind.SHIPMENT_CONFIRMED,
            _encodedTx(1, address(emitter), _topicShipment(), tradeId)
        );
    }

    // -----------------------------------------------------------------
    // The two adapters are distinguishable on-chain
    // -----------------------------------------------------------------

    function test_adaptersReportDistinctProofKinds() public view {
        assertEq(uint8(uscAdapter.proofKind()), uint8(TradeTypes.ProofKind.USC_PROOF));
        assertEq(uint8(demoAdapter.proofKind()), uint8(TradeTypes.ProofKind.DEMO_OPERATOR));
    }

    function test_demoAttestationIsLabelledDemo() public {
        uint256 tradeId = _fundTrade();
        vm.prank(owner);
        bytes32 id = demoAdapter.assertEvent(
            tradeId,
            TradeTypes.EventKind.SHIPMENT_CONFIRMED,
            SEPOLIA_CHAIN_KEY,
            SOURCE_HEIGHT,
            keccak256("tx"),
            0,
            address(emitter)
        );
        TradeTypes.Attestation memory a = demoAdapter.getAttestation(id);
        // A demo record can never masquerade as a proved one: the field is set by the adapter,
        // not by the caller.
        assertEq(uint8(a.proofKind), uint8(TradeTypes.ProofKind.DEMO_OPERATOR));
        assertTrue(a.proofKind != TradeTypes.ProofKind.USC_PROOF);
    }

    function test_uscAttestationIsLabelledProved() public {
        uint256 tradeId = _fundTrade();
        bytes32 id = uscAdapter.submitProof(_validSubmission(tradeId));
        assertEq(uint8(uscAdapter.getAttestation(id).proofKind), uint8(TradeTypes.ProofKind.USC_PROOF));
    }

    // -----------------------------------------------------------------
    // Proof requirement
    // -----------------------------------------------------------------

    function test_requireProofBacked_rejectsDemoAttestation() public {
        uint256 tradeId = _fundTrade();

        vm.prank(owner);
        finance.setRequireProofBacked(true);

        vm.prank(owner);
        bytes32 id = demoAdapter.assertEvent(
            tradeId,
            TradeTypes.EventKind.SHIPMENT_CONFIRMED,
            SEPOLIA_CHAIN_KEY,
            SOURCE_HEIGHT,
            keccak256("tx"),
            0,
            address(emitter)
        );

        vm.expectRevert(TradeTypes.ProofRequired.selector);
        finance.advanceWithAttestation(tradeId, id);
        assertEq(uint8(_stateOf(tradeId)), uint8(TradeTypes.TradeState.FUNDED));
    }

    function test_requireProofBacked_acceptsUscAttestation() public {
        uint256 tradeId = _fundTrade();

        vm.startPrank(owner);
        finance.setAttestationAdapter(IAttestationAdapter(address(uscAdapter)));
        finance.setRequireProofBacked(true);
        vm.stopPrank();

        bytes32 id = uscAdapter.submitProof(_validSubmission(tradeId));
        finance.advanceWithAttestation(tradeId, id);
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
        UscAttestationAdapter.ProofSubmission memory s = _submission(
            tradeId,
            TradeTypes.EventKind.SHIPMENT_CONFIRMED,
            _encodedTx(1, address(emitter), keccak256("Transfer(address,address,uint256)"), tradeId)
        );
        vm.expectRevert(
            abi.encodeWithSelector(
                UscAttestationAdapter.TopicMismatch.selector,
                _topicShipment(),
                keccak256("Transfer(address,address,uint256)")
            )
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
        uscAdapter.submitProof(_validSubmission(tradeId));
    }

    function test_revertsWhenHeightNotAttested() public {
        uint256 tradeId = _fundTrade();
        UscAttestationAdapter.ProofSubmission memory s = _validSubmission(tradeId);
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
        UscAttestationAdapter.ProofSubmission memory s = _validSubmission(tradeId);
        s.sourceChainKey = 99;
        vm.expectRevert(
            abi.encodeWithSelector(UscAttestationAdapter.UnsupportedSourceChain.selector, uint64(99))
        );
        uscAdapter.submitProof(s);
    }

    function test_revertsOnOutOfRangeFieldOffset() public {
        uint256 tradeId = _fundTrade();
        UscAttestationAdapter.ProofSubmission memory s = _validSubmission(tradeId);
        s.fields.tradeId = 4096; // past the end of the buffer
        vm.expectRevert();
        uscAdapter.submitProof(s);
    }

    // -----------------------------------------------------------------
    // Replay
    // -----------------------------------------------------------------

    function test_sameSourceLogCannotBeRecordedTwice() public {
        uint256 tradeId = _fundTrade();
        UscAttestationAdapter.ProofSubmission memory s = _validSubmission(tradeId);
        bytes32 id = uscAdapter.submitProof(s);

        vm.expectRevert(abi.encodeWithSelector(TradeTypes.AttestationReplayed.selector, id));
        uscAdapter.submitProof(s);
    }

    function test_sameAttestationCannotAdvanceTwice() public {
        uint256 tradeId = _fundTrade();
        bytes32 id = _advanceByDemo(tradeId, TradeTypes.EventKind.SHIPMENT_CONFIRMED, 0);

        vm.expectRevert(abi.encodeWithSelector(TradeFinance.AttestationAlreadyApplied.selector, id));
        finance.advanceWithAttestation(tradeId, id);
    }

    function test_attestationForAnotherTradeIsRejected() public {
        uint256 tradeA = _fundTrade();
        uint256 tradeB = _fundTrade();

        vm.prank(owner);
        bytes32 id = demoAdapter.assertEvent(
            tradeB,
            TradeTypes.EventKind.SHIPMENT_CONFIRMED,
            SEPOLIA_CHAIN_KEY,
            SOURCE_HEIGHT,
            keccak256("tx-b"),
            0,
            address(emitter)
        );

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
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(
                BaseAttestationAdapter.TopicNotRegistered.selector, TradeTypes.EventKind.REPAYMENT_SETTLED
            )
        );
        demoAdapter.assertEvent(
            tradeId,
            TradeTypes.EventKind.REPAYMENT_SETTLED,
            SEPOLIA_CHAIN_KEY,
            SOURCE_HEIGHT,
            keccak256("tx"),
            0,
            address(emitter)
        );
    }

    function test_onlyOperatorCanAssertDemoEvents() public {
        uint256 tradeId = _fundTrade();
        vm.prank(outsider);
        vm.expectRevert(abi.encodeWithSelector(DemoAttestationAdapter.NotOperator.selector, outsider));
        demoAdapter.assertEvent(
            tradeId,
            TradeTypes.EventKind.SHIPMENT_CONFIRMED,
            SEPOLIA_CHAIN_KEY,
            SOURCE_HEIGHT,
            keccak256("tx"),
            0,
            address(emitter)
        );
    }

    function test_proofSubmissionIsPermissionless() public {
        uint256 tradeId = _fundTrade();
        // Anyone may submit a valid proof; validity, not identity, is what counts.
        vm.prank(outsider);
        bytes32 id = uscAdapter.submitProof(_validSubmission(tradeId));
        assertTrue(uscAdapter.isRecorded(id));
    }

    function test_topicRegistryIsOwnerOnly() public {
        vm.prank(outsider);
        vm.expectRevert();
        uscAdapter.registerTopic(TradeTypes.EventKind.SHIPMENT_CONFIRMED, keccak256("x"));
    }

    /// @dev The emitter contract's real event signature must match what the adapter is configured
    ///      to expect. If someone changes the event, this fails rather than silently rejecting
    ///      every proof at runtime.
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
