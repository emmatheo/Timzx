// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {TradeTypes} from "../TradeTypes.sol";
import {BaseAttestationAdapter} from "./BaseAttestationAdapter.sol";
import {IAttestationAdapter} from "../interfaces/IAttestationAdapter.sol";

/// @title DemoAttestationAdapter
/// @notice Testnet-only adapter that lets a permissioned operator assert that a source-chain event
///         occurred, so the trade lifecycle can be walked end to end before a source-chain emitter
///         and proof pipeline exist.
///
/// @dev NOTHING IS PROVEN HERE. Every attestation this contract records carries
///      `ProofKind.DEMO_OPERATOR`, and `proofKind()` returns that value permanently, so any
///      caller — contract, indexer or UI — can tell demo records from proved ones without relying
///      on naming or configuration. `TradeFinance.requireProofBacked` exists precisely so a
///      production deployment can refuse these outright.
///
///      This contract must never be deployed on Creditcoin mainnet.
contract DemoAttestationAdapter is BaseAttestationAdapter {
    /// @notice Accounts allowed to assert events.
    mapping(address => bool) public operators;

    event OperatorSet(address indexed operator, bool allowed);

    error NotOperator(address caller);

    constructor(address initialOwner) BaseAttestationAdapter(initialOwner) {
        operators[initialOwner] = true;
        emit OperatorSet(initialOwner, true);
    }

    modifier onlyOperator() {
        if (!operators[msg.sender]) revert NotOperator(msg.sender);
        _;
    }

    function setOperator(address operator, bool allowed) external onlyOwner {
        if (operator == address(0)) revert TradeTypes.ZeroAddress();
        operators[operator] = allowed;
        emit OperatorSet(operator, allowed);
    }

    /// @inheritdoc IAttestationAdapter
    function proofKind() external pure returns (TradeTypes.ProofKind) {
        return TradeTypes.ProofKind.DEMO_OPERATOR;
    }

    /// @notice Assert that a source-chain event occurred, without proving it.
    /// @dev Deliberately keeps the same emitter/topic registry checks as the real adapter, so a
    ///      demo run exercises the same configuration surface that production will use. The only
    ///      thing missing is the cryptography — which is exactly what `proofKind` records.
    /// @param sourceTxHash A real transaction hash on the source chain if one exists. Callers
    ///        should pass a genuine hash or `bytes32(0)`; the UI renders a demo attestation with a
    ///        proof-pending state either way and never labels it verified.
    function assertEvent(
        uint256 tradeId,
        TradeTypes.EventKind kind,
        uint64 sourceChainKey,
        uint64 sourceHeight,
        bytes32 sourceTxHash,
        uint32 logIndex,
        address emitter
    ) external onlyOperator returns (bytes32 id) {
        id = attestationId(sourceChainKey, sourceTxHash, logIndex);
        _record(
            id,
            tradeId,
            kind,
            TradeTypes.ProofKind.DEMO_OPERATOR,
            sourceChainKey,
            sourceHeight,
            sourceTxHash,
            emitter
        );
    }
}
