// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {TradeTypes} from "../TradeTypes.sol";
import {BaseAttestationAdapter} from "./BaseAttestationAdapter.sol";
import {IAttestationAdapter} from "../interfaces/IAttestationAdapter.sol";
import {IChainInfo, ChainInfoLib} from "../interfaces/IChainInfo.sol";
import {INativeQueryVerifier, NativeQueryVerifierLib} from "../interfaces/INativeQueryVerifier.sol";

/// @title UscAttestationAdapter
/// @notice Establishes trade events by proving, on Creditcoin, that the corresponding transaction
///         was included in a finalized block of an attested source chain.
///
/// @dev The full path this contract implements:
///
///        source chain event
///            -> attestor set attests the source block on Creditcoin
///            -> off-chain: the gluwa usc-sdk package builds a Merkle + continuity proof and a field map
///            -> here: block-prover precompile `0x…0FD2` verifies inclusion
///            -> here: the proven bytes are read at the field offsets and bound to a trade
///            -> TradeFinance advances the trade state
///
///      Two distinct checks are needed and both are done here. Inclusion alone only proves that
///      *some* transaction was in the block; it says nothing about what the transaction contained.
///      So after `verify` succeeds, the same `encodedTransaction` bytes that were proven are read
///      at offsets computed off-chain by the SDK `QueryBuilder`, and the extracted values must
///      match the trade, the event kind and a trusted emitter. Reading any other buffer would
///      break the binding, which is why the proven `bytes` are the only source of field data.
contract UscAttestationAdapter is BaseAttestationAdapter {
    /// @notice Byte offsets into the canonical encoding of the proven transaction.
    /// @dev Produced off-chain by `QueryBuilder.build()` in the gluwa usc-sdk package, which returns
    ///      `{offset,size}` pairs into the same `abiEncode(tx, receipt)` buffer that is proven.
    ///      All four fields are 32-byte words. Offsets depend on the source chain's
    ///      `chainEncoding` (see the ChainInfo precompile), so they are supplied per call rather
    ///      than stored.
    /// @param rxStatus Receipt status word. Must be 1: a reverted source transaction proves nothing.
    /// @param logAddress The emitting contract address for the matched log, left-padded.
    /// @param topic0 The matched log's event signature.
    /// @param tradeId The trade identifier carried as an argument of the matched log.
    struct QueryFields {
        uint32 rxStatus;
        uint32 logAddress;
        uint32 topic0;
        uint32 tradeId;
    }

    /// @notice Everything needed to prove and bind one source-chain event.
    struct ProofSubmission {
        uint256 tradeId;
        TradeTypes.EventKind kind;
        uint64 sourceChainKey;
        uint64 sourceHeight;
        bytes32 sourceTxHash;
        uint32 logIndex;
        bytes encodedTransaction;
        INativeQueryVerifier.MerkleProof merkleProof;
        INativeQueryVerifier.ContinuityProof continuityProof;
        QueryFields fields;
    }

    INativeQueryVerifier public immutable verifier;
    IChainInfo public immutable chainInfo;

    error InclusionProofFailed();
    error SourceTransactionReverted();
    error HeightNotAttested(uint64 sourceChainKey, uint64 height);
    error UnsupportedSourceChain(uint64 sourceChainKey);
    error FieldOutOfRange(uint32 offset, uint256 length);
    error TradeIdMismatch(uint256 expected, uint256 found);
    error TopicMismatch(bytes32 expected, bytes32 found);

    /// @param initialOwner Account permitted to register topics and trusted emitters.
    /// @param verifier_ Block-prover address. Pass `address(0)` to use the canonical precompile;
    ///        an explicit address exists so the contract is testable without a Creditcoin node.
    /// @param chainInfo_ ChainInfo address, same convention.
    constructor(address initialOwner, address verifier_, address chainInfo_)
        BaseAttestationAdapter(initialOwner)
    {
        verifier =
            verifier_ == address(0) ? NativeQueryVerifierLib.getVerifier() : INativeQueryVerifier(verifier_);
        chainInfo = chainInfo_ == address(0) ? ChainInfoLib.getChainInfo() : IChainInfo(chainInfo_);
    }

    /// @inheritdoc IAttestationAdapter
    function proofKind() external pure returns (TradeTypes.ProofKind) {
        return TradeTypes.ProofKind.USC_PROOF;
    }

    /// @notice Prove a source-chain event and record it against a trade.
    /// @dev Permissionless by design. Nothing here depends on who submits the proof, only on
    ///      whether the proof verifies — so a relayer, the buyer, or a financier can all submit,
    ///      and none of them can submit anything false.
    /// @return id The canonical attestation id, to be passed to
    ///         `TradeFinance.advanceWithAttestation`.
    function submitProof(ProofSubmission calldata s) external returns (bytes32 id) {
        // 1. The source chain must be one this Creditcoin network actually tracks, and the block
        //    must already be attested. Checking this first turns an opaque precompile revert into
        //    a diagnosable error, and mirrors `waitUntilHeightAttested` in the SDK.
        IChainInfo.ChainInfoResult memory chain = chainInfo.get_chain_by_key(s.sourceChainKey);
        if (!chain.exists) revert UnsupportedSourceChain(s.sourceChainKey);
        if (!chainInfo.is_height_attested(s.sourceChainKey, s.sourceHeight)) {
            revert HeightNotAttested(s.sourceChainKey, s.sourceHeight);
        }

        // 2. Prove inclusion of the transaction in the attested block.
        bool ok = verifier.verify(
            s.sourceChainKey, s.sourceHeight, s.encodedTransaction, s.merkleProof, s.continuityProof
        );
        if (!ok) revert InclusionProofFailed();

        // 3. Bind the proven bytes to this trade. Steps 2 and 3 must read the same buffer.
        _bindProvenFields(s);

        id = attestationId(s.sourceChainKey, s.sourceTxHash, s.logIndex);
        _record(
            id,
            s.tradeId,
            s.kind,
            TradeTypes.ProofKind.USC_PROOF,
            s.sourceChainKey,
            s.sourceHeight,
            s.sourceTxHash,
            _addressAt(s.encodedTransaction, s.fields.logAddress)
        );
    }

    /// @dev Reads the queried fields out of the proven transaction encoding and checks that they
    ///      describe the event being claimed. Split out to keep `submitProof` within stack limits.
    function _bindProvenFields(ProofSubmission calldata s) private view {
        bytes calldata data = s.encodedTransaction;

        if (uint256(_wordAt(data, s.fields.rxStatus)) != 1) revert SourceTransactionReverted();

        bytes32 topic = _wordAt(data, s.fields.topic0);
        bytes32 expected = expectedTopic0[s.kind];
        if (expected == bytes32(0)) revert TopicNotRegistered(s.kind);
        if (topic != expected) revert TopicMismatch(expected, topic);

        uint256 provenTradeId = uint256(_wordAt(data, s.fields.tradeId));
        if (provenTradeId != s.tradeId) revert TradeIdMismatch(s.tradeId, provenTradeId);

        // The emitter check itself happens in `_record`, against `trustedEmitter`.
        // Reading it here keeps the revert reason precise when the address word is malformed.
        _addressAt(data, s.fields.logAddress);
    }

    /// @dev Load a 32-byte word from calldata at `offset`, bounds-checked.
    function _wordAt(bytes calldata data, uint32 offset) private pure returns (bytes32 w) {
        if (uint256(offset) + 32 > data.length) revert FieldOutOfRange(offset, data.length);
        assembly {
            w := calldataload(add(data.offset, offset))
        }
    }

    /// @dev Load a left-padded address word, rejecting any word with dirty high bytes rather than
    ///      silently truncating it.
    function _addressAt(bytes calldata data, uint32 offset) private pure returns (address) {
        bytes32 w = _wordAt(data, offset);
        if (uint256(w) >> 160 != 0) revert FieldOutOfRange(offset, data.length);
        return address(uint160(uint256(w)));
    }
}
