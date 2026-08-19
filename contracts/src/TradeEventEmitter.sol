// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title TradeEventEmitter
/// @notice Deployed on the SOURCE chain (e.g. Ethereum Sepolia), not on Creditcoin.
/// @dev This is the origin of the cross-chain events the protocol consumes. A logistics provider,
///      customs system or shipping oracle calls it on the source chain; the attestor set attests
///      the block; a proof of the resulting log is then verified on Creditcoin by
///      `UscAttestationAdapter`.
///
///      It exists as a real contract rather than a stub because the proof pipeline needs something
///      concrete to prove: `topic0` of these events is what gets registered via
///      `BaseAttestationAdapter.registerTopic`, and this address is what gets registered via
///      `setTrustedEmitter`.
///
///      `tradeId` is the FIRST indexed argument in every event, which is what makes the
///      QueryBuilder field map uniform across event kinds.
contract TradeEventEmitter {
    address public owner;

    /// @notice Accounts permitted to report real-world events for a corridor.
    mapping(address => bool) public reporters;

    event ShipmentConfirmed(
        uint256 indexed tradeId, bytes32 indexed documentHash, address reporter, uint64 occurredAt
    );
    event DeliveryConfirmed(
        uint256 indexed tradeId, bytes32 indexed documentHash, address reporter, uint64 occurredAt
    );
    event SupplierVerified(
        uint256 indexed tradeId, address indexed supplier, address reporter, uint64 occurredAt
    );

    event ReporterSet(address indexed reporter, bool allowed);

    error NotOwner();
    error NotReporter();

    constructor(address initialOwner) {
        owner = initialOwner;
        reporters[initialOwner] = true;
        emit ReporterSet(initialOwner, true);
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyReporter() {
        if (!reporters[msg.sender]) revert NotReporter();
        _;
    }

    function setReporter(address reporter, bool allowed) external onlyOwner {
        reporters[reporter] = allowed;
        emit ReporterSet(reporter, allowed);
    }

    /// @param documentHash Digest of the bill of lading or equivalent, anchoring the paperwork to
    ///        the on-chain event without publishing it.
    function confirmShipment(uint256 tradeId, bytes32 documentHash) external onlyReporter {
        emit ShipmentConfirmed(tradeId, documentHash, msg.sender, uint64(block.timestamp));
    }

    function confirmDelivery(uint256 tradeId, bytes32 documentHash) external onlyReporter {
        emit DeliveryConfirmed(tradeId, documentHash, msg.sender, uint64(block.timestamp));
    }

    function verifySupplier(uint256 tradeId, address supplier) external onlyReporter {
        emit SupplierVerified(tradeId, supplier, msg.sender, uint64(block.timestamp));
    }
}
