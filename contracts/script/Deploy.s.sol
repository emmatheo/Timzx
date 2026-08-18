// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";

import {TradeTypes} from "../src/TradeTypes.sol";
import {TradeFinance} from "../src/TradeFinance.sol";
import {CollateralVault} from "../src/CollateralVault.sol";
import {TradeEscrow} from "../src/TradeEscrow.sol";
import {RepaymentManager} from "../src/RepaymentManager.sol";
import {TestnetFaucet} from "../src/TestnetFaucet.sol";
import {TestUSD} from "../src/mocks/TestUSD.sol";
import {DemoAttestationAdapter} from "../src/adapters/DemoAttestationAdapter.sol";
import {UscAttestationAdapter} from "../src/adapters/UscAttestationAdapter.sol";
import {IAttestationAdapter} from "../src/interfaces/IAttestationAdapter.sol";
import {TradeEventEmitter as TradeEventEmitterDeployable} from "../src/TradeEventEmitter.sol";

/// @notice Deploys the full protocol to a Creditcoin network.
/// @dev Both adapters are deployed. Which one the protocol uses is a runtime choice
///      (`USE_USC_ADAPTER`), so a deployment can start on the demo adapter and switch to the real
///      one with a single owner transaction once a source-chain emitter is live — no redeploy and
///      no loss of trade state.
///
///      Env:
///        PRIVATE_KEY        deployer key
///        SOURCE_CHAIN_KEY   Creditcoin's key for the source chain (NOT the EVM chainId)
///        SOURCE_EMITTER     TradeEventEmitter address on the source chain
///        USE_USC_ADAPTER    "true" to start with the proving adapter
///        REQUIRE_PROOF      "true" to reject demo attestations on-chain
contract Deploy is Script {
    uint256 internal constant USD = 1e6;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        uint64 sourceChainKey = uint64(vm.envOr("SOURCE_CHAIN_KEY", uint256(3)));
        address sourceEmitter = vm.envOr("SOURCE_EMITTER", address(0));
        bool useUsc = vm.envOr("USE_USC_ADAPTER", false);
        bool requireProof = vm.envOr("REQUIRE_PROOF", false);

        vm.startBroadcast(pk);

        TestUSD token = new TestUSD(deployer);
        CollateralVault vault = new CollateralVault(deployer, address(token));
        TradeEscrow escrow = new TradeEscrow(deployer, address(token));
        RepaymentManager repayments = new RepaymentManager(deployer, address(token));

        DemoAttestationAdapter demo = new DemoAttestationAdapter(deployer);
        // address(0) selects the canonical Creditcoin precompiles.
        UscAttestationAdapter usc = new UscAttestationAdapter(deployer, address(0), address(0));

        IAttestationAdapter active =
            useUsc ? IAttestationAdapter(address(usc)) : IAttestationAdapter(address(demo));

        TradeFinance finance = new TradeFinance(deployer, vault, escrow, repayments, active, requireProof);

        vault.setController(address(finance));
        escrow.setController(address(finance));
        repayments.setController(address(finance));

        _configure(demo, usc, sourceChainKey, sourceEmitter);

        TestnetFaucet faucet = new TestnetFaucet(deployer, address(token), 250_000 * USD, 12 hours);
        token.mint(address(faucet), 100_000_000 * USD);

        vm.stopBroadcast();

        console2.log("NEXT_PUBLIC_TRADE_FINANCE_ADDRESS=%s", address(finance));
        console2.log("NEXT_PUBLIC_COLLATERAL_VAULT_ADDRESS=%s", address(vault));
        console2.log("NEXT_PUBLIC_TRADE_ESCROW_ADDRESS=%s", address(escrow));
        console2.log("NEXT_PUBLIC_REPAYMENT_MANAGER_ADDRESS=%s", address(repayments));
        console2.log("NEXT_PUBLIC_DEMO_ADAPTER_ADDRESS=%s", address(demo));
        console2.log("NEXT_PUBLIC_USC_ADAPTER_ADDRESS=%s", address(usc));
        console2.log("NEXT_PUBLIC_SETTLEMENT_TOKEN_ADDRESS=%s", address(token));
        console2.log("NEXT_PUBLIC_FAUCET_ADDRESS=%s", address(faucet));
    }

    /// @dev Registers the same topics and emitter on both adapters so switching between them never
    ///      changes which events are recognised — only whether they are proved.
    function _configure(
        DemoAttestationAdapter demo,
        UscAttestationAdapter usc,
        uint64 sourceChainKey,
        address sourceEmitter
    ) internal {
        bytes32 shipment = keccak256("ShipmentConfirmed(uint256,bytes32,address,uint64)");
        bytes32 delivery = keccak256("DeliveryConfirmed(uint256,bytes32,address,uint64)");
        bytes32 supplier = keccak256("SupplierVerified(uint256,address,address,uint64)");

        demo.registerTopic(TradeTypes.EventKind.SHIPMENT_CONFIRMED, shipment);
        demo.registerTopic(TradeTypes.EventKind.DELIVERY_CONFIRMED, delivery);
        demo.registerTopic(TradeTypes.EventKind.SUPPLIER_VERIFIED, supplier);

        usc.registerTopic(TradeTypes.EventKind.SHIPMENT_CONFIRMED, shipment);
        usc.registerTopic(TradeTypes.EventKind.DELIVERY_CONFIRMED, delivery);
        usc.registerTopic(TradeTypes.EventKind.SUPPLIER_VERIFIED, supplier);

        if (sourceEmitter != address(0)) {
            demo.setTrustedEmitter(sourceChainKey, sourceEmitter, true);
            usc.setTrustedEmitter(sourceChainKey, sourceEmitter, true);
        }
    }
}

/// @notice Deploys the source-chain event emitter. Run against Sepolia, not Creditcoin.
contract DeployEmitter is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(pk);
        address emitter = address(new TradeEventEmitterDeployable(vm.addr(pk)));
        vm.stopBroadcast();
        console2.log("SOURCE_EMITTER=%s", emitter);
    }
}
