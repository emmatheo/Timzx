// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IChainInfo
/// @notice Creditcoin ChainInfo precompile at `0x…0FD3` (4051). Reports which source chains the
///         local Creditcoin network supports and how far attestation has progressed on each.
/// @dev Subset of the full precompile ABI (see `chain_info.json` in the gluwa usc-sdk package) covering
///      only what the protocol needs on-chain. The SDK exposes the rest for off-chain callers.
interface IChainInfo {
    struct ChainInfo {
        uint64 chainKey;
        uint64 chainId;
        bytes chainName;
        uint8 chainEncoding;
    }

    struct ChainInfoResult {
        ChainInfo info;
        bool exists;
    }

    /// @notice All source chains supported by this Creditcoin network.
    /// @dev The authoritative mapping from `chainKey` to EVM `chainId`. These are different
    ///      numbers and the mapping differs per Creditcoin environment, so it must be read at
    ///      runtime rather than hardcoded.
    function get_supported_chains() external view returns (ChainInfo[] memory chains);

    /// @notice Look up a single supported chain by its Creditcoin chain key.
    function get_chain_by_key(uint64 chainKey) external view returns (ChainInfoResult memory result);

    /// @notice Whether the attestor set has attested a source-chain height.
    /// @dev A proof cannot be produced for a height that is not yet attested.
    function is_height_attested(uint64 chainKey, uint64 targetHeight) external view returns (bool);
}

/// @notice Address helper for the ChainInfo precompile.
library ChainInfoLib {
    address internal constant PRECOMPILE_ADDRESS = 0x0000000000000000000000000000000000000fD3;

    function getChainInfo() internal pure returns (IChainInfo) {
        return IChainInfo(PRECOMPILE_ADDRESS);
    }
}
