// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {TradeTypes} from "../TradeTypes.sol";
import {IAttestationAdapter} from "../interfaces/IAttestationAdapter.sol";

/// @title BaseAttestationAdapter
/// @notice Storage, replay protection and event-signature registry shared by all adapters.
/// @dev Concrete adapters implement only how an event is *established*. Everything about how it is
///      recorded, keyed and read back lives here so the two implementations cannot drift.
abstract contract BaseAttestationAdapter is IAttestationAdapter, Ownable {
    /// @dev attestationId => attestation.
    mapping(bytes32 => TradeTypes.Attestation) internal _attestations;

    /// @notice Event topic0 expected on the source chain for each event kind.
    /// @dev Registered by the owner per deployment. An attestation whose topic0 is not the one
    ///      registered for its claimed kind is rejected, so a proof of some unrelated log cannot be
    ///      passed off as a shipment confirmation.
    mapping(TradeTypes.EventKind => bytes32) public expectedTopic0;

    /// @notice Source-chain contracts authorised to emit trade events, per chain key.
    /// @dev `sourceChainKey => emitter => allowed`.
    mapping(uint64 => mapping(address => bool)) public trustedEmitter;

    event TopicRegistered(TradeTypes.EventKind indexed kind, bytes32 topic0);
    event EmitterTrustSet(uint64 indexed sourceChainKey, address indexed emitter, bool trusted);

    error UnknownEventKind();
    error UntrustedEmitter(uint64 sourceChainKey, address emitter);
    error TopicNotRegistered(TradeTypes.EventKind kind);

    constructor(address initialOwner) Ownable(initialOwner) {}

    /// @notice Register the source-chain event signature that represents `kind`.
    function registerTopic(TradeTypes.EventKind kind, bytes32 topic0) external onlyOwner {
        if (kind == TradeTypes.EventKind.UNKNOWN) revert UnknownEventKind();
        expectedTopic0[kind] = topic0;
        emit TopicRegistered(kind, topic0);
    }

    /// @notice Allow or disallow a source-chain contract to originate trade events.
    function setTrustedEmitter(uint64 sourceChainKey, address emitter, bool trusted) external onlyOwner {
        if (emitter == address(0)) revert TradeTypes.ZeroAddress();
        trustedEmitter[sourceChainKey][emitter] = trusted;
        emit EmitterTrustSet(sourceChainKey, emitter, trusted);
    }

    /// @inheritdoc IAttestationAdapter
    function attestationId(uint64 sourceChainKey, bytes32 sourceTxHash, uint32 logIndex)
        public
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(sourceChainKey, sourceTxHash, logIndex));
    }

    /// @inheritdoc IAttestationAdapter
    function getAttestation(bytes32 id) external view returns (TradeTypes.Attestation memory) {
        return _attestations[id];
    }

    /// @inheritdoc IAttestationAdapter
    function isRecorded(bytes32 id) public view returns (bool) {
        return _attestations[id].proofKind != TradeTypes.ProofKind.NONE;
    }

    /// @dev Common validation and persistence for both adapters.
    ///      Reverts on replay, on an unregistered topic, and on an untrusted emitter.
    function _record(
        bytes32 id,
        uint256 tradeId,
        TradeTypes.EventKind kind,
        TradeTypes.ProofKind kindOfProof,
        uint64 sourceChainKey,
        uint64 sourceHeight,
        bytes32 sourceTxHash,
        address emitter
    ) internal {
        if (isRecorded(id)) revert TradeTypes.AttestationReplayed(id);
        if (kind == TradeTypes.EventKind.UNKNOWN) revert UnknownEventKind();
        if (expectedTopic0[kind] == bytes32(0)) revert TopicNotRegistered(kind);
        if (!trustedEmitter[sourceChainKey][emitter]) {
            revert UntrustedEmitter(sourceChainKey, emitter);
        }

        _attestations[id] = TradeTypes.Attestation({
            tradeId: tradeId,
            kind: kind,
            proofKind: kindOfProof,
            sourceChainKey: sourceChainKey,
            sourceHeight: sourceHeight,
            sourceTxHash: sourceTxHash,
            emitter: emitter,
            recordedAt: uint64(block.timestamp)
        });

        emit AttestationRecorded(id, tradeId, kind, kindOfProof, sourceChainKey, sourceTxHash);
    }
}
