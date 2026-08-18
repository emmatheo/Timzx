// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IChainInfo} from "../interfaces/IChainInfo.sol";
import {INativeQueryVerifier} from "../interfaces/INativeQueryVerifier.sol";

/// @title MockChainInfo
/// @notice Test double for the Creditcoin ChainInfo precompile at `0x…0FD3`.
/// @dev Exists so `UscAttestationAdapter` can be tested against a local EVM. It answers the same
///      questions the precompile answers; it does not attest anything. Never deploy outside tests.
contract MockChainInfo is IChainInfo {
    mapping(uint64 => ChainInfo) internal _chains;
    mapping(uint64 => bool) internal _known;
    uint64[] internal _keys;

    /// @dev `chainKey => height => attested`.
    mapping(uint64 => mapping(uint64 => bool)) internal _attested;

    function addChain(uint64 chainKey, uint64 chainId, string calldata name, uint8 encoding) external {
        if (!_known[chainKey]) _keys.push(chainKey);
        _known[chainKey] = true;
        _chains[chainKey] = ChainInfo(chainKey, chainId, bytes(name), encoding);
    }

    function setAttested(uint64 chainKey, uint64 height, bool attested) external {
        _attested[chainKey][height] = attested;
    }

    function get_supported_chains() external view returns (ChainInfo[] memory chains) {
        chains = new ChainInfo[](_keys.length);
        for (uint256 i = 0; i < _keys.length; i++) {
            chains[i] = _chains[_keys[i]];
        }
    }

    function get_chain_by_key(uint64 chainKey) external view returns (ChainInfoResult memory) {
        return ChainInfoResult(_chains[chainKey], _known[chainKey]);
    }

    function is_height_attested(uint64 chainKey, uint64 targetHeight) external view returns (bool) {
        return _attested[chainKey][targetHeight];
    }
}

/// @title MockBlockProver
/// @notice Test double for the Creditcoin block-prover precompile at `0x…0FD2`.
/// @dev Returns a configurable answer. Because it accepts any bytes, tests that use it prove only
///      that the adapter's *binding* logic is correct — that it reads the right offsets, rejects a
///      reverted source transaction, an unregistered topic, a mismatched trade id and an untrusted
///      emitter. The cryptography itself belongs to the real precompile and is verified against a
///      live Creditcoin network, not here.
contract MockBlockProver is INativeQueryVerifier {
    bool public result = true;
    bool public shouldRevert;

    error MockProofRejected();

    function setResult(bool result_) external {
        result = result_;
    }

    function setShouldRevert(bool shouldRevert_) external {
        shouldRevert = shouldRevert_;
    }

    function verify(uint64, uint64, bytes calldata, MerkleProof calldata, ContinuityProof calldata)
        external
        view
        returns (bool)
    {
        if (shouldRevert) revert MockProofRejected();
        return result;
    }
}
