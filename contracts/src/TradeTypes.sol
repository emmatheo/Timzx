// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title TradeTypes
/// @notice Shared enums, structs and errors for the TImx trade-finance protocol.
/// @dev Every status in the protocol is an enum. There are no string statuses anywhere: an
///      invalid transition is unrepresentable rather than merely rejected at the API layer.
library TradeTypes {
    /// @notice Lifecycle of a cross-border trade.
    /// @dev Ordering is meaningful. `_assertState` comparisons and the UI timeline both rely on
    ///      the declaration order matching the real-world sequence.
    enum TradeState {
        APPLICATION, // 0  trade created by the buyer, awaiting supplier verification
        SUPPLIER_VERIFIED, // 1  supplier identity/eligibility confirmed
        COLLATERAL_LOCKED, // 2  buyer collateral held by the CollateralVault
        FINANCING_APPROVED, // 3  financier capital committed to the TradeEscrow
        FUNDED, // 4  escrow released to the supplier
        SHIPPED, // 5  shipment confirmed (cross-chain attested event)
        DELIVERED, // 6  delivery confirmed (cross-chain attested event)
        REPAYING, // 7  at least one repayment made, balance outstanding
        REPAID, // 8  outstanding balance cleared
        COMPLETED, // 9  collateral released, trade closed
        DEFAULTED, // 10 matured unpaid, collateral claimed by the financier
        CANCELLED // 11 closed before financing, collateral refunded
    }

    /// @notice Roles an address can hold on a specific trade.
    enum Party {
        NONE,
        BUYER,
        SUPPLIER,
        FINANCIER
    }

    /// @notice Classes of real-world event that can advance a trade.
    /// @dev Each maps to an event emitted by a registered emitter contract on a source chain.
    ///      The adapter proves the source transaction was included in an attested source block
    ///      before the protocol will act on it.
    enum EventKind {
        UNKNOWN,
        SUPPLIER_VERIFIED,
        SHIPMENT_CONFIRMED,
        DELIVERY_CONFIRMED,
        REPAYMENT_SETTLED
    }

    /// @notice How a given attestation was established.
    /// @dev This is the honesty switch that runs through the whole system. `USC_PROOF` is the only
    ///      value that means "a Merkle + continuity proof was verified by the Creditcoin block-prover
    ///      precompile". `DEMO_OPERATOR` means a permissioned operator asserted the event on a
    ///      testnet deployment and NOTHING was cryptographically proven. The frontend renders these
    ///      two differently and must never present the second as the first.
    enum ProofKind {
        NONE,
        USC_PROOF,
        DEMO_OPERATOR
    }

    /// @notice A cross-chain event that the protocol has accepted as having happened.
    /// @param tradeId       Trade the event refers to.
    /// @param kind          Class of event.
    /// @param proofKind     How this was established. See {ProofKind}.
    /// @param sourceChainKey Creditcoin's identifier for the source chain. NOT the EVM chainId.
    /// @param sourceHeight  Block height on the source chain containing the transaction.
    /// @param sourceTxHash  Transaction hash on the source chain.
    /// @param emitter       Contract on the source chain that emitted the event.
    /// @param recordedAt    Creditcoin block timestamp at which this was recorded.
    struct Attestation {
        uint256 tradeId;
        EventKind kind;
        ProofKind proofKind;
        uint64 sourceChainKey;
        uint64 sourceHeight;
        bytes32 sourceTxHash;
        address emitter;
        uint64 recordedAt;
    }

    /// @notice Immutable commercial terms of a trade, fixed at creation.
    /// @param tradeValue     Full value of the goods, in settlement-token units.
    /// @param collateral     Buyer contribution, in settlement-token units.
    /// @param financing      Amount sought from a financier (tradeValue - collateral).
    /// @param interestBps    Simple interest over the full term, in basis points of financing.
    /// @param termDays       Days from funding to maturity.
    struct Terms {
        uint256 tradeValue;
        uint256 collateral;
        uint256 financing;
        uint16 interestBps;
        uint16 termDays;
    }

    /// @notice Full on-chain record of a trade.
    struct Trade {
        uint256 id;
        address buyer;
        address supplier;
        address financier;
        Terms terms;
        TradeState state;
        uint64 createdAt;
        uint64 fundedAt;
        uint64 maturityAt;
        bytes32 metadataHash; // keccak256 of the off-chain trade document set
    }

    // ---------------------------------------------------------------------
    // Errors
    // ---------------------------------------------------------------------

    /// @notice Thrown when an action is attempted from a state that does not permit it.
    error InvalidState(uint256 tradeId, TradeState actual, TradeState required);
    /// @notice Thrown when the caller does not hold the required role on this trade.
    error NotAuthorized(uint256 tradeId, address caller, Party required);
    /// @notice Thrown when a trade id has never been created.
    error UnknownTrade(uint256 tradeId);
    error ZeroAddress();
    error ZeroAmount();
    /// @notice Thrown when collateral is not strictly between 0 and the trade value.
    error InvalidTerms();
    /// @notice Thrown when an attestation does not match the trade or event it is presented for.
    error AttestationMismatch();
    /// @notice Thrown when a proof-backed attestation is required but a demo one was supplied.
    error ProofRequired();
    /// @notice Thrown when the same source transaction is replayed.
    error AttestationReplayed(bytes32 attestationId);
}
