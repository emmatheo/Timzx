// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title INativeQueryVerifier
/// @notice Creditcoin block-prover precompile at `0x…0FD2` (4050). Natively verifies that a
///         transaction was included in a finalized block of an attested source chain, via a Merkle
///         proof against the block's transaction root plus a continuity proof linking that block
///         back to a height the Creditcoin attestor set has attested.
/// @dev Struct layouts and the `verify` signature are byte-identical with the canonical interface
///      shipped in the gluwa usc-contracts package (`contracts/write-ability/INativeQueryVerifier.sol`).
///      Do not reorder fields: the precompile decodes by position.
interface INativeQueryVerifier {
    struct MerkleProofEntry {
        bytes32 hash;
        bool isLeft;
    }

    struct MerkleProof {
        bytes32 root;
        MerkleProofEntry[] siblings;
    }

    struct ContinuityProof {
        bytes32 lowerEndpointDigest;
        bytes32[] roots;
    }

    /// @notice Verify a transaction's inclusion in a finalized block. Reverts on failure,
    ///         returns true on success.
    /// @param chainKey Creditcoin's identifier for the source chain. NOT the EVM chainId.
    /// @param height Block height on the source chain.
    /// @param encodedTransaction Canonically ABI-encoded transaction + receipt, as produced by
    ///        `abiEncode()` in the gluwa usc-sdk package. Field offsets used by callers are computed
    ///        off-chain by the SDK `QueryBuilder` against this same encoding.
    function verify(
        uint64 chainKey,
        uint64 height,
        bytes calldata encodedTransaction,
        MerkleProof calldata merkleProof,
        ContinuityProof calldata continuityProof
    ) external view returns (bool);
}

/// @notice Address helper for the block-prover precompile.
library NativeQueryVerifierLib {
    address internal constant PRECOMPILE_ADDRESS = 0x0000000000000000000000000000000000000FD2;

    function getVerifier() internal pure returns (INativeQueryVerifier) {
        return INativeQueryVerifier(PRECOMPILE_ADDRESS);
    }
}
