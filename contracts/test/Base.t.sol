// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";

import {TradeTypes} from "../src/TradeTypes.sol";
import {TradeFinance} from "../src/TradeFinance.sol";
import {CollateralVault} from "../src/CollateralVault.sol";
import {TradeEscrow} from "../src/TradeEscrow.sol";
import {RepaymentManager} from "../src/RepaymentManager.sol";
import {TradeEventEmitter} from "../src/TradeEventEmitter.sol";
import {DemoAttestationAdapter} from "../src/adapters/DemoAttestationAdapter.sol";
import {UscAttestationAdapter} from "../src/adapters/UscAttestationAdapter.sol";
import {IAttestationAdapter} from "../src/interfaces/IAttestationAdapter.sol";
import {TestUSD} from "../src/mocks/TestUSD.sol";
import {MockChainInfo, MockBlockProver} from "../src/mocks/MockPrecompiles.sol";

/// @notice Shared fixture: a deployed protocol, funded actors and the standard $50,000 solar trade.
abstract contract BaseTest is Test {
    // The demo corridor used throughout the product: Sepolia as source chain.
    uint64 internal constant SEPOLIA_CHAIN_KEY = 3;
    uint64 internal constant SEPOLIA_CHAIN_ID = 11155111;
    uint64 internal constant SOURCE_HEIGHT = 8_100_000;

    uint256 internal constant USD = 1e6;
    uint256 internal constant TRADE_VALUE = 50_000 * USD;
    uint256 internal constant COLLATERAL = 10_000 * USD;
    uint256 internal constant FINANCING = 40_000 * USD;
    uint16 internal constant INTEREST_BPS = 800; // 8% over the term
    uint16 internal constant TERM_DAYS = 90;

    address internal owner = makeAddr("owner");
    address internal buyer = makeAddr("buyer");
    address internal supplier = makeAddr("supplier");
    address internal financier = makeAddr("financier");
    address internal outsider = makeAddr("outsider");

    TestUSD internal token;
    CollateralVault internal vault;
    TradeEscrow internal escrow;
    RepaymentManager internal repayments;
    DemoAttestationAdapter internal demoAdapter;
    UscAttestationAdapter internal uscAdapter;
    TradeFinance internal finance;
    TradeEventEmitter internal emitter;
    MockChainInfo internal chainInfo;
    MockBlockProver internal prover;

    function setUp() public virtual {
        vm.startPrank(owner);

        token = new TestUSD(owner);
        vault = new CollateralVault(owner, address(token));
        escrow = new TradeEscrow(owner, address(token));
        repayments = new RepaymentManager(owner, address(token));

        chainInfo = new MockChainInfo();
        prover = new MockBlockProver();
        emitter = new TradeEventEmitter(owner);

        demoAdapter = new DemoAttestationAdapter(owner);
        uscAdapter = new UscAttestationAdapter(owner, address(prover), address(chainInfo));

        finance = new TradeFinance(
            owner, vault, escrow, repayments, IAttestationAdapter(address(demoAdapter)), false
        );

        vault.setController(address(finance));
        escrow.setController(address(finance));
        repayments.setController(address(finance));

        // Both adapters are configured identically, so switching between them changes only whether
        // events are proved — never which events are recognised.
        _configureAdapter(demoAdapter);
        _configureUscAdapter();

        chainInfo.addChain(SEPOLIA_CHAIN_KEY, SEPOLIA_CHAIN_ID, "sepolia", 1);
        chainInfo.setAttested(SEPOLIA_CHAIN_KEY, SOURCE_HEIGHT, true);

        token.mint(buyer, 1_000_000 * USD);
        token.mint(financier, 1_000_000 * USD);

        vm.stopPrank();
    }

    function _configureAdapter(DemoAttestationAdapter a) internal {
        a.registerTopic(TradeTypes.EventKind.SHIPMENT_CONFIRMED, _topicShipment());
        a.registerTopic(TradeTypes.EventKind.DELIVERY_CONFIRMED, _topicDelivery());
        a.registerTopic(TradeTypes.EventKind.SUPPLIER_VERIFIED, _topicSupplier());
        a.setTrustedEmitter(SEPOLIA_CHAIN_KEY, address(emitter), true);
    }

    function _configureUscAdapter() internal {
        uscAdapter.registerTopic(TradeTypes.EventKind.SHIPMENT_CONFIRMED, _topicShipment());
        uscAdapter.registerTopic(TradeTypes.EventKind.DELIVERY_CONFIRMED, _topicDelivery());
        uscAdapter.registerTopic(TradeTypes.EventKind.SUPPLIER_VERIFIED, _topicSupplier());
        uscAdapter.setTrustedEmitter(SEPOLIA_CHAIN_KEY, address(emitter), true);
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

    /// @notice Create the standard trade as `buyer`.
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

    /// @notice Record a demo attestation and apply it to a trade.
    function _advanceByDemo(uint256 tradeId, TradeTypes.EventKind kind, uint32 logIndex)
        internal
        returns (bytes32 id)
    {
        vm.prank(owner);
        id = demoAdapter.assertEvent(
            tradeId,
            kind,
            SEPOLIA_CHAIN_KEY,
            SOURCE_HEIGHT,
            keccak256(abi.encode(tradeId, kind)),
            logIndex,
            address(emitter)
        );
        finance.advanceWithAttestation(tradeId, id);
    }

    function _stateOf(uint256 tradeId) internal view returns (TradeTypes.TradeState) {
        return finance.getTrade(tradeId).state;
    }
}
