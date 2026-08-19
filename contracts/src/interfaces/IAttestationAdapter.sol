// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {TradeTypes} from "../TradeTypes.sol";

/// @title IAttestationAdapter
/// @notice The seam between the trade-finance protocol and cross-chain verification.
/// @dev TradeFinance never talks to a precompile directly. It asks an adapter "has this event been
///      established, and how?" and decides for itself whether the answer is strong enough. That
///      indirection keeps the protocol independent of how proofs are obtained, while the recorded
///      proof kind means it can never lose track of how a given event was established.
interface IAttestationAdapter {
    /// @notice Emitted whenever an attestation is recorded, by any adapter implementation.
    /// @param proofKind Provenance of the record. Always `USC_PROOF` for an accepted event.
    event AttestationRecorded(
        bytes32 indexed attestationId,
        uint256 indexed tradeId,
        TradeTypes.EventKind indexed kind,
        TradeTypes.ProofKind proofKind,
        uint64 sourceChainKey,
        bytes32 sourceTxHash
    );

    /// @notice Fetch a recorded attestation.
    /// @dev Returns a zeroed struct (`proofKind == NONE`) when `attestationId` is unknown.
    function getAttestation(bytes32 attestationId) external view returns (TradeTypes.Attestation memory);

    /// @notice Whether `attestationId` has been recorded by this adapter.
    function isRecorded(bytes32 attestationId) external view returns (bool);

    /// @notice The strongest proof kind this adapter is capable of producing.
    /// @dev A deployment can be inspected — on-chain and in the UI — to determine whether its
    ///      attestations are cryptographic or merely asserted, without trusting any label.
    function proofKind() external view returns (TradeTypes.ProofKind);

    /// @notice Canonical id for a source-chain event, used for replay protection.
    /// @dev Derived from the source chain, transaction and log index, so the same source log can
    ///      never be recorded twice regardless of which trade it is presented for.
    function attestationId(uint64 sourceChainKey, bytes32 sourceTxHash, uint32 logIndex)
        external
        pure
        returns (bytes32);
}
