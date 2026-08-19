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
import {IChainInfo, ChainInfoLib} from "../src/interfaces/IChainInfo.sol";

/// @notice Deploys the protocol to a Creditcoin network.
///
/// @dev There is one attestation adapter and it proves. Cross-chain events reach the protocol
///      only through `UscAttestationAdapter`, which verifies against the block-prover precompile
///      before recording anything.
///
///      The script refuses to deploy rather than produce a protocol that cannot work. Three
///      preflight checks run before a single contract is created:
///
///        1. `block.chainid` must equal `EXPECTED_CHAIN_ID`. A mistyped `--rpc-url` would
///           otherwise deploy a full protocol onto a chain with no Creditcoin precompiles, where
///           every attestation reverts and the failure only surfaces days later.
///        2. The ChainInfo precompile must respond. This is what distinguishes a Creditcoin USC
///           network from any other EVM chain, and the protocol is inert without it.
///        3. `SOURCE_CHAIN_KEY` must be a chain this Creditcoin network actually tracks. The key
///           is not the EVM chain id and the mapping differs per environment, so the value is
///           checked against the precompile rather than trusted.
///
///      Preflight 2 and 3 are skipped on chain id 31337 only, where the precompiles do not exist
///      by definition. That skip relaxes a deployment diagnostic and nothing else — the on-chain
///      proof requirement in `TradeFinance` is unconditional on every chain, so a trade still
///      cannot advance past FUNDED on a local node.
///
///      Env:
///        PRIVATE_KEY        deployer key
///        EXPECTED_CHAIN_ID  chain this run is intended for (default 102031, cc3-testnet)
///        SOURCE_CHAIN_KEY   Creditcoin's key for the source chain (NOT the EVM chainId)
///        SOURCE_EMITTER     TradeEventEmitter address on the source chain (required)
///        SETTLEMENT_TOKEN   existing settlement stablecoin; deploys one when unset
///        FAUCET_SUPPLY      units to mint into the faucet; skips the faucet when zero
contract Deploy is Script {
    /// @dev Creditcoin testnet. Overridable, so devnet and local runs are explicit rather than
    ///      accidental.
    uint256 internal constant DEFAULT_CHAIN_ID = 102031;
    uint256 internal constant LOCAL_CHAIN_ID = 31337;

    error SourceEmitterRequired();
    error WrongChain(uint256 expected, uint256 actual);
    error ChainInfoUnavailable(address precompile);
    error SourceChainNotSupported(uint64 chainKey);
    error WiringFailed(string what);

    /// @dev Grouped so `_deploy` stays within the stack limit without `via_ir`, which would change
    ///      the bytecode of every contract in the repo for the sake of one script.
    struct Config {
        uint256 pk;
        address deployer;
        uint64 sourceChainKey;
        address sourceEmitter;
        address existingToken;
        uint256 faucetSupply;
    }

    struct Deployment {
        address token;
        address vault;
        address escrow;
        address repayments;
        address adapter;
        address finance;
        address faucet;
    }

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        Config memory c = Config({
            pk: pk,
            deployer: vm.addr(pk),
            sourceChainKey: uint64(vm.envOr("SOURCE_CHAIN_KEY", uint256(3))),
            sourceEmitter: vm.envOr("SOURCE_EMITTER", address(0)),
            existingToken: vm.envOr("SETTLEMENT_TOKEN", address(0)),
            faucetSupply: vm.envOr("FAUCET_SUPPLY", uint256(0))
        });

        // Without a trusted emitter no proof can ever bind to a trade, so the protocol would
        // deploy into a state where no trade can advance past FUNDED. Fail now, not later.
        if (c.sourceEmitter == address(0)) revert SourceEmitterRequired();

        _preflight(c.sourceChainKey);

        Deployment memory d = _deploy(c);

        _assertWiring(d, c.sourceChainKey, c.sourceEmitter);
        _report(d, c);
    }

    // ---------------------------------------------------------------------
    // Preflight
    // ---------------------------------------------------------------------

    function _preflight(uint64 sourceChainKey) internal view {
        uint256 expectedChainId = vm.envOr("EXPECTED_CHAIN_ID", DEFAULT_CHAIN_ID);
        if (block.chainid != expectedChainId) revert WrongChain(expectedChainId, block.chainid);

        if (block.chainid == LOCAL_CHAIN_ID) {
            console2.log("Local chain: skipping precompile preflight. Trades cannot pass FUNDED here.");
            return;
        }

        // A staticcall rather than a typed call, so a chain without the precompile reports
        // "ChainInfo did not respond" instead of failing inside abi.decode with no explanation.
        (bool ok, bytes memory ret) = ChainInfoLib.PRECOMPILE_ADDRESS
            .staticcall(abi.encodeWithSelector(IChainInfo.get_chain_by_key.selector, sourceChainKey));
        if (!ok || ret.length == 0) revert ChainInfoUnavailable(ChainInfoLib.PRECOMPILE_ADDRESS);

        IChainInfo.ChainInfoResult memory result = abi.decode(ret, (IChainInfo.ChainInfoResult));
        if (!result.exists) revert SourceChainNotSupported(sourceChainKey);

        // Printed because chainKey and chainId are different numbers that are easy to confuse.
        // Seeing the EVM chain id this key resolves to is the cheapest way to catch a wrong key.
        console2.log("Source chainKey %s -> EVM chainId %s", sourceChainKey, result.info.chainId);
        console2.log("Source chain encoding: %s", result.info.chainEncoding);
    }

    // ---------------------------------------------------------------------
    // Deployment
    // ---------------------------------------------------------------------

    function _deploy(Config memory c) internal returns (Deployment memory d) {
        vm.startBroadcast(c.pk);

        d.token = c.existingToken;
        if (d.token == address(0)) {
            d.token = address(new SettlementToken("TImx Settlement USD", "tUSD", c.deployer));
        }

        d.vault = address(new CollateralVault(c.deployer, d.token));
        d.escrow = address(new TradeEscrow(c.deployer, d.token));
        d.repayments = address(new RepaymentManager(c.deployer, d.token));

        // address(0) selects the canonical Creditcoin precompiles.
        d.adapter = address(new UscAttestationAdapter(c.deployer, address(0), address(0)));

        d.finance = address(
            new TradeFinance(
                c.deployer,
                CollateralVault(d.vault),
                TradeEscrow(d.escrow),
                RepaymentManager(d.repayments),
                IAttestationAdapter(d.adapter)
            )
        );

        CollateralVault(d.vault).setController(d.finance);
        TradeEscrow(d.escrow).setController(d.finance);
        RepaymentManager(d.repayments).setController(d.finance);

        UscAttestationAdapter adapter = UscAttestationAdapter(d.adapter);
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
        adapter.setTrustedEmitter(c.sourceChainKey, c.sourceEmitter, true);

        // The faucet holds a minted balance and hands it out; it is deliberately not a minter, so
        // the most it can ever leak is what it was funded with.
        if (c.faucetSupply > 0 && c.existingToken == address(0)) {
            d.faucet = address(new TestnetFaucet(c.deployer, d.token, c.faucetSupply / 400, 12 hours));
            SettlementToken(d.token).mint(d.faucet, c.faucetSupply);
        }

        vm.stopBroadcast();
    }

    // ---------------------------------------------------------------------
    // Post-deploy assertions
    // ---------------------------------------------------------------------

    /// @dev A half-wired protocol looks identical to a working one until the first trade fails.
    ///      These reads cost nothing and turn that into a failed deploy.
    function _assertWiring(Deployment memory d, uint64 sourceChainKey, address sourceEmitter) internal view {
        if (CollateralVault(d.vault).controller() != d.finance) revert WiringFailed("vault.controller");
        if (TradeEscrow(d.escrow).controller() != d.finance) revert WiringFailed("escrow.controller");
        if (RepaymentManager(d.repayments).controller() != d.finance) {
            revert WiringFailed("repayments.controller");
        }
        if (address(TradeFinance(d.finance).attestationAdapter()) != d.adapter) {
            revert WiringFailed("finance.attestationAdapter");
        }

        UscAttestationAdapter adapter = UscAttestationAdapter(d.adapter);
        if (adapter.proofKind() != TradeTypes.ProofKind.USC_PROOF) revert WiringFailed("adapter.proofKind");
        if (!adapter.trustedEmitter(sourceChainKey, sourceEmitter)) revert WiringFailed("adapter.emitter");
        if (adapter.expectedTopic0(TradeTypes.EventKind.SHIPMENT_CONFIRMED) == bytes32(0)) {
            revert WiringFailed("adapter.topic.shipment");
        }
        if (adapter.expectedTopic0(TradeTypes.EventKind.DELIVERY_CONFIRMED) == bytes32(0)) {
            revert WiringFailed("adapter.topic.delivery");
        }
        if (adapter.expectedTopic0(TradeTypes.EventKind.SUPPLIER_VERIFIED) == bytes32(0)) {
            revert WiringFailed("adapter.topic.supplier");
        }
    }

    // ---------------------------------------------------------------------
    // Reporting
    // ---------------------------------------------------------------------

    /// @dev Writes `deployments/<chainid>.json` as well as printing, because Foundry's broadcast
    ///      files are gitignored and the console output is gone as soon as the terminal scrolls.
    ///      The addresses are the one artefact of a deploy that is expensive to recover.
    function _report(Deployment memory d, Config memory c) internal {
        console2.log("NEXT_PUBLIC_TRADE_FINANCE_ADDRESS=%s", d.finance);
        console2.log("NEXT_PUBLIC_COLLATERAL_VAULT_ADDRESS=%s", d.vault);
        console2.log("NEXT_PUBLIC_TRADE_ESCROW_ADDRESS=%s", d.escrow);
        console2.log("NEXT_PUBLIC_REPAYMENT_MANAGER_ADDRESS=%s", d.repayments);
        console2.log("NEXT_PUBLIC_USC_ADAPTER_ADDRESS=%s", d.adapter);
        console2.log("NEXT_PUBLIC_SETTLEMENT_TOKEN_ADDRESS=%s", d.token);
        console2.log("NEXT_PUBLIC_FAUCET_ADDRESS=%s", d.faucet);
        console2.log("NEXT_PUBLIC_SOURCE_EMITTER_ADDRESS=%s", c.sourceEmitter);
        console2.log("NEXT_PUBLIC_SOURCE_CHAIN_KEY=%s", c.sourceChainKey);

        string memory json = string.concat(
            "{\n",
            '  "chainId": ',
            vm.toString(block.chainid),
            ",\n",
            '  "deployer": "',
            vm.toString(c.deployer),
            '",\n',
            '  "sourceChainKey": ',
            vm.toString(c.sourceChainKey),
            ",\n",
            '  "sourceEmitter": "',
            vm.toString(c.sourceEmitter),
            '",\n',
            '  "tradeFinance": "',
            vm.toString(d.finance),
            '",\n',
            '  "collateralVault": "',
            vm.toString(d.vault),
            '",\n',
            '  "tradeEscrow": "',
            vm.toString(d.escrow),
            '",\n',
            '  "repaymentManager": "',
            vm.toString(d.repayments),
            '",\n',
            '  "uscAttestationAdapter": "',
            vm.toString(d.adapter),
            '",\n',
            '  "settlementToken": "',
            vm.toString(d.token),
            '",\n',
            '  "testnetFaucet": "',
            vm.toString(d.faucet),
            '"\n',
            "}\n"
        );

        string memory path = string.concat("deployments/", vm.toString(block.chainid), ".json");
        vm.writeFile(path, json);
        console2.log("Wrote %s", path);
    }
}

/// @notice Deploys the source-chain event emitter. Run against the source chain, not Creditcoin.
/// @dev Deploy this first. Its address is `SOURCE_EMITTER` for the main script, and it is the only
///      address the adapter will accept proofs from — an event emitted by any other contract fails
///      the `trustedEmitter` check even with a perfectly valid inclusion proof.
contract DeployEmitter is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(pk);
        address emitter = address(new TradeEventEmitter(vm.addr(pk)));
        vm.stopBroadcast();
        console2.log("SOURCE_EMITTER=%s", emitter);
        console2.log("Deployed on chainId %s", block.chainid);
    }
}
