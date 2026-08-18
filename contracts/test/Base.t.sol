// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";

import {TradeTypes} from "../src/TradeTypes.sol";
import {TradeFinance} from "../src/TradeFinance.sol";
import {CollateralVault} from "../src/CollateralVault.sol";
import {TradeEscrow} from "../src/TradeEscrow.sol";
import {RepaymentManager} from "../src/RepaymentManager.sol";
import {TradeEventEmitter} from "../src/TradeEventEmitter.sol";
import {SettlementToken} from "../src/SettlementToken.sol";
import {UscAttestationAdapter} from "../src/adapters/UscAttestationAdapter.sol";
import {IAttestationAdapter} from "../src/interfaces/IAttestationAdapter.sol";
import {INativeQueryVerifier} from "../src/interfaces/INativeQueryVerifier.sol";
import {MockChainInfo, MockBlockProver} from "./mocks/MockPrecompiles.sol";

/// @notice Shared fixture: a deployed protocol, funded actors and the standard $50,000 trade.
/// @dev Every lifecycle advance in the suite goes through `UscAttestationAdapter.submitProof`.
///      There is no shortcut helper that records an event without proving it, because the protocol
///      offers no such path — the tests exercise the only route that exists.
abstract contract BaseTest is Test {
    uint64 internal constant SEPOLIA_CHAIN_KEY = 3;
    uint64 internal constant SEPOLIA_CHAIN_ID = 11155111;
    uint64 internal constant SOURCE_HEIGHT = 8_100_000;

    uint256 internal constant USD = 1e6;
    uint256 internal constant TRADE_VALUE = 50_000 * USD;
    uint256 internal constant COLLATERAL = 10_000 * USD;
    uint256 internal constant FINANCING = 40_000 * USD;
    uint16 internal constant INTEREST_BPS = 800; // 8% over the term
    uint16 internal constant TERM_DAYS = 90;

    // Layout of the encoded-transaction buffer these tests prove against. In production these
    // offsets come from `QueryBuilder.build()` in the gluwa usc-sdk package.
    uint32 internal constant OFF_RX_STATUS = 0;
    uint32 internal constant OFF_LOG_ADDRESS = 32;
    uint32 internal constant OFF_TOPIC0 = 64;
    uint32 internal constant OFF_TRADE_ID = 96;

    address internal owner = makeAddr("owner");
    address internal buyer = makeAddr("buyer");
    address internal supplier = makeAddr("supplier");
    address internal financier = makeAddr("financier");
    address internal outsider = makeAddr("outsider");

    SettlementToken internal token;
    CollateralVault internal vault;
    TradeEscrow internal escrow;
    RepaymentManager internal repayments;
    UscAttestationAdapter internal uscAdapter;
    TradeFinance internal finance;
    TradeEventEmitter internal emitter;
    MockChainInfo internal chainInfo;
    MockBlockProver internal prover;

    function setUp() public virtual {
        vm.startPrank(owner);

        token = new SettlementToken("TImx Settlement USD", "tUSD", owner);
        vault = new CollateralVault(owner, address(token));
        escrow = new TradeEscrow(owner, address(token));
        repayments = new RepaymentManager(owner, address(token));

        chainInfo = new MockChainInfo();
        prover = new MockBlockProver();
        emitter = new TradeEventEmitter(owner);

        uscAdapter = new UscAttestationAdapter(owner, address(prover), address(chainInfo));
        finance = new TradeFinance(owner, vault, escrow, repayments, IAttestationAdapter(address(uscAdapter)));

        vault.setController(address(finance));
        escrow.setController(address(finance));
        repayments.setController(address(finance));

        uscAdapter.registerTopic(TradeTypes.EventKind.SHIPMENT_CONFIRMED, _topicShipment());
        uscAdapter.registerTopic(TradeTypes.EventKind.DELIVERY_CONFIRMED, _topicDelivery());
        uscAdapter.registerTopic(TradeTypes.EventKind.SUPPLIER_VERIFIED, _topicSupplier());
        uscAdapter.setTrustedEmitter(SEPOLIA_CHAIN_KEY, address(emitter), true);

        chainInfo.addChain(SEPOLIA_CHAIN_KEY, SEPOLIA_CHAIN_ID, "sepolia", 1);
        chainInfo.setAttested(SEPOLIA_CHAIN_KEY, SOURCE_HEIGHT, true);

        token.mint(buyer, 1_000_000 * USD);
        token.mint(financier, 1_000_000 * USD);

        vm.stopPrank();
    }

    function _topicShipment() internal pure returns (bytes32) {
        return keccak256("ShipmentConfirmed(uint256,bytes32,address,uint64)");
    }

    function _topicDelivery() internal pure returns (bytes32) {
        return keccak256("DeliveryConfirmed(uint256,bytes32,address,uint64)");
    }

    function _topicSupplier() internal pure returns (bytes32) {
        return keccak256("SupplierVerified(uint256,address,address,uint64)");
    }

    function _fields() internal pure returns (UscAttestationAdapter.QueryFields memory) {
        return UscAttestationAdapter.QueryFields({
            rxStatus: OFF_RX_STATUS, logAddress: OFF_LOG_ADDRESS, topic0: OFF_TOPIC0, tradeId: OFF_TRADE_ID
        });
    }

    function _topicFor(TradeTypes.EventKind kind) internal pure returns (bytes32) {
        if (kind == TradeTypes.EventKind.SHIPMENT_CONFIRMED) return _topicShipment();
        if (kind == TradeTypes.EventKind.DELIVERY_CONFIRMED) return _topicDelivery();
        return _topicSupplier();
    }

    /// @dev Builds the buffer the adapter reads after inclusion is proved.
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
        s.logIndex = uint32(uint8(kind));
        s.encodedTransaction = encoded;
        s.merkleProof = INativeQueryVerifier.MerkleProof({
            root: keccak256("root"), siblings: new INativeQueryVerifier.MerkleProofEntry[](0)
        });
        s.continuityProof = INativeQueryVerifier.ContinuityProof({
            lowerEndpointDigest: keccak256("lower"), roots: new bytes32[](0)
        });
        s.fields = _fields();
    }

    /// @notice A well-formed submission for `tradeId` and `kind`.
    function _validSubmission(uint256 tradeId, TradeTypes.EventKind kind)
        internal
        view
        returns (UscAttestationAdapter.ProofSubmission memory)
    {
        return _submission(tradeId, kind, _encodedTx(1, address(emitter), _topicFor(kind), tradeId));
    }

    function _createTrade() internal returns (uint256 tradeId) {
        vm.prank(buyer);
        tradeId = finance.createTrade(
            supplier, TRADE_VALUE, COLLATERAL, INTEREST_BPS, TERM_DAYS, keccak256("docs")
        );
    }

    /// @notice Drive a trade to FUNDED through the ordinary happy path.
    function _fundTrade() internal returns (uint256 tradeId) {
        tradeId = _createTrade();

        vm.prank(owner);
        finance.verifySupplier(tradeId);

        vm.startPrank(buyer);
        token.approve(address(vault), COLLATERAL);
        finance.depositCollateral(tradeId);
        vm.stopPrank();

        vm.startPrank(financier);
        token.approve(address(escrow), FINANCING);
        finance.commitFinancing(tradeId);
        vm.stopPrank();

        vm.prank(buyer);
        finance.releaseFunds(tradeId);
    }

    /// @notice Prove a source-chain event and apply it to the trade.
    function _advanceByProof(uint256 tradeId, TradeTypes.EventKind kind) internal returns (bytes32 id) {
        id = uscAdapter.submitProof(_validSubmission(tradeId, kind));
        finance.advanceWithAttestation(tradeId, id);
    }

    function _stateOf(uint256 tradeId) internal view returns (TradeTypes.TradeState) {
        return finance.getTrade(tradeId).state;
    }
}
