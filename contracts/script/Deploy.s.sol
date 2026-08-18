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
import {SettlementToken} from "../src/SettlementToken.sol";
import {TradeEventEmitter} from "../src/TradeEventEmitter.sol";
import {UscAttestationAdapter} from "../src/adapters/UscAttestationAdapter.sol";
import {IAttestationAdapter} from "../src/interfaces/IAttestationAdapter.sol";

/// @notice Deploys the protocol to a Creditcoin network.
///
/// @dev There is one attestation adapter and it proves. Cross-chain events reach the protocol
///      only through `UscAttestationAdapter`, which verifies against the block-prover precompile
///      before recording anything.
///
///      Env:
///        PRIVATE_KEY        deployer key
///        SOURCE_CHAIN_KEY   Creditcoin's key for the source chain (NOT the EVM chainId)
///        SOURCE_EMITTER     TradeEventEmitter address on the source chain (required)
///        SETTLEMENT_TOKEN   existing settlement stablecoin; deploys one when unset
///        FAUCET_SUPPLY      units to mint into the faucet; skips the faucet when zero
contract Deploy is Script {
    error SourceEmitterRequired();

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        uint64 sourceChainKey = uint64(vm.envOr("SOURCE_CHAIN_KEY", uint256(3)));
        address sourceEmitter = vm.envOr("SOURCE_EMITTER", address(0));
        address existingToken = vm.envOr("SETTLEMENT_TOKEN", address(0));
        uint256 faucetSupply = vm.envOr("FAUCET_SUPPLY", uint256(0));

        // Without a trusted emitter no proof can ever bind to a trade, so the protocol would
        // deploy into a state where no trade can advance past FUNDED. Fail now, not later.
        if (sourceEmitter == address(0)) revert SourceEmitterRequired();

        vm.startBroadcast(pk);

        address token = existingToken;
        if (token == address(0)) {
            token = address(new SettlementToken("TImx Settlement USD", "tUSD", deployer));
        }

        CollateralVault vault = new CollateralVault(deployer, token);
        TradeEscrow escrow = new TradeEscrow(deployer, token);
        RepaymentManager repayments = new RepaymentManager(deployer, token);

        // address(0) selects the canonical Creditcoin precompiles.
        UscAttestationAdapter adapter = new UscAttestationAdapter(deployer, address(0), address(0));

        TradeFinance finance =
            new TradeFinance(deployer, vault, escrow, repayments, IAttestationAdapter(address(adapter)));

        vault.setController(address(finance));
        escrow.setController(address(finance));
        repayments.setController(address(finance));

        adapter.registerTopic(
            TradeTypes.EventKind.SHIPMENT_CONFIRMED,
            keccak256("ShipmentConfirmed(uint256,bytes32,address,uint64)")
        );
        adapter.registerTopic(
            TradeTypes.EventKind.DELIVERY_CONFIRMED,
            keccak256("DeliveryConfirmed(uint256,bytes32,address,uint64)")
        );
        adapter.registerTopic(
            TradeTypes.EventKind.SUPPLIER_VERIFIED,
            keccak256("SupplierVerified(uint256,address,address,uint64)")
        );
        adapter.setTrustedEmitter(sourceChainKey, sourceEmitter, true);

        address faucet;
        if (faucetSupply > 0 && existingToken == address(0)) {
            faucet = address(new TestnetFaucet(deployer, token, faucetSupply / 400, 12 hours));
            SettlementToken(token).setMinter(faucet, false);
            SettlementToken(token).mint(faucet, faucetSupply);
        }

        vm.stopBroadcast();

        console2.log("NEXT_PUBLIC_TRADE_FINANCE_ADDRESS=%s", address(finance));
        console2.log("NEXT_PUBLIC_COLLATERAL_VAULT_ADDRESS=%s", address(vault));
        console2.log("NEXT_PUBLIC_TRADE_ESCROW_ADDRESS=%s", address(escrow));
        console2.log("NEXT_PUBLIC_REPAYMENT_MANAGER_ADDRESS=%s", address(repayments));
        console2.log("NEXT_PUBLIC_USC_ADAPTER_ADDRESS=%s", address(adapter));
        console2.log("NEXT_PUBLIC_SETTLEMENT_TOKEN_ADDRESS=%s", token);
        console2.log("NEXT_PUBLIC_FAUCET_ADDRESS=%s", faucet);
        console2.log("NEXT_PUBLIC_SOURCE_EMITTER_ADDRESS=%s", sourceEmitter);
    }
}

/// @notice Deploys the source-chain event emitter. Run against the source chain, not Creditcoin.
contract DeployEmitter is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(pk);
        address emitter = address(new TradeEventEmitter(vm.addr(pk)));
        vm.stopBroadcast();
        console2.log("SOURCE_EMITTER=%s", emitter);
    }
}
