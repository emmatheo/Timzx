// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {TradeTypes} from "./TradeTypes.sol";
import {CollateralVault} from "./CollateralVault.sol";
import {TradeEscrow} from "./TradeEscrow.sol";
import {RepaymentManager} from "./RepaymentManager.sol";
import {IAttestationAdapter} from "./interfaces/IAttestationAdapter.sol";

/// @title TradeFinance
/// @notice The state machine at the centre of TImx. Owns the lifecycle of every cross-border
///         trade and is the sole authorised caller of the collateral, escrow and repayment modules.
///
/// @dev The organising idea is that a trade's state is only ever changed by a transition function
///      that (a) asserts the exact required prior state, (b) asserts the caller's role on that
///      specific trade, and (c) moves funds through a module rather than directly. Three of the
///      transitions — supplier verification, shipment and delivery — correspond to things that
///      happen off Creditcoin, and those accept an attestation id rather than a caller's word.
///
///      Nothing here trusts an attestation because of who submitted it. `_consumeAttestation`
///      re-derives every property it cares about from the adapter's stored record.
contract TradeFinance is Ownable, ReentrancyGuard {
    using TradeTypes for TradeTypes.TradeState;

    // ---------------------------------------------------------------------
    // Storage
    // ---------------------------------------------------------------------

    CollateralVault public immutable collateralVault;
    TradeEscrow public immutable escrow;
    RepaymentManager public immutable repayments;

    /// @notice Adapter consulted for cross-chain events.
    /// @dev Swappable by the owner so a deployment can move from the demo adapter to the USC
    ///      adapter without redeploying the protocol or migrating trade state.
    IAttestationAdapter public attestationAdapter;

    /// @notice When true, only `ProofKind.USC_PROOF` attestations are accepted.
    /// @dev The switch that makes demo mode safe to ship: a mainnet deployment sets this and every
    ///      demo-operator assertion is rejected on-chain, not merely discouraged in the UI.
    bool public requireProofBacked;

    /// @notice Accounts permitted to verify suppliers off-chain (KYB path).
    mapping(address => bool) public supplierVerifiers;

    uint256 public nextTradeId = 1;
    mapping(uint256 => TradeTypes.Trade) internal _trades;

    /// @notice Attestations already applied, so one source event advances one trade once.
    mapping(bytes32 => bool) public attestationConsumed;

    /// @notice Aggregate, on-chain-derived activity per address. The Credit Profile page reads this.
    /// @dev Deliberately counts only what this contract observed. It is activity, not a score.
    struct CreditRecord {
        uint32 tradesAsBuyer;
        uint32 tradesCompleted;
        uint32 tradesDefaulted;
        uint32 tradesFinanced;
        uint256 volumeTransacted;
        uint256 volumeFinanced;
        uint256 volumeRepaid;
        uint64 cumulativeRepaymentDays;
    }

    mapping(address => CreditRecord) internal _credit;

    // ---------------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------------

    event TradeCreated(
        uint256 indexed tradeId,
        address indexed buyer,
        address indexed supplier,
        uint256 tradeValue,
        uint256 collateral,
        uint256 financing,
        uint16 interestBps,
        uint16 termDays,
        bytes32 metadataHash
    );
    event TradeStateChanged(
        uint256 indexed tradeId,
        TradeTypes.TradeState indexed from,
        TradeTypes.TradeState indexed to,
        address actor
    );
    event SupplierVerified(uint256 indexed tradeId, address indexed supplier, bool byAttestation);
    event FinancingCommitted(uint256 indexed tradeId, address indexed financier, uint256 amount);
    event FundsReleased(uint256 indexed tradeId, address indexed supplier, uint256 amount);
    event TradeRepaid(uint256 indexed tradeId, uint256 amount, uint256 outstanding);
    event TradeCompleted(uint256 indexed tradeId, uint256 collateralReturned);
    event TradeDefaulted(uint256 indexed tradeId, uint256 collateralSeized, uint256 shortfall);
    event TradeCancelled(uint256 indexed tradeId, address actor);
    event AttestationApplied(
        uint256 indexed tradeId,
        bytes32 indexed attestationId,
        TradeTypes.EventKind kind,
        TradeTypes.ProofKind proofKind,
        TradeTypes.TradeState newState
    );
    event AttestationAdapterChanged(address indexed adapter, TradeTypes.ProofKind proofKind);
    event ProofRequirementChanged(bool required);
    event SupplierVerifierSet(address indexed verifier, bool allowed);

    error NotSupplierVerifier(address caller);
    error AttestationAlreadyApplied(bytes32 attestationId);
    error UnexpectedEventKind(TradeTypes.EventKind kind);
    error SelfFinancingForbidden();
    error NotMatured(uint64 maturityAt);
    error NothingToRepay();

    // ---------------------------------------------------------------------
    // Construction
    // ---------------------------------------------------------------------

    constructor(
        address initialOwner,
        CollateralVault collateralVault_,
        TradeEscrow escrow_,
        RepaymentManager repayments_,
        IAttestationAdapter adapter_,
        bool requireProofBacked_
    ) Ownable(initialOwner) {
        if (
            address(collateralVault_) == address(0) || address(escrow_) == address(0)
                || address(repayments_) == address(0) || address(adapter_) == address(0)
        ) revert TradeTypes.ZeroAddress();

        collateralVault = collateralVault_;
        escrow = escrow_;
        repayments = repayments_;
        attestationAdapter = adapter_;
        requireProofBacked = requireProofBacked_;
        supplierVerifiers[initialOwner] = true;

        emit AttestationAdapterChanged(address(adapter_), adapter_.proofKind());
        emit ProofRequirementChanged(requireProofBacked_);
        emit SupplierVerifierSet(initialOwner, true);
    }

    // ---------------------------------------------------------------------
    // Administration
    // ---------------------------------------------------------------------

    /// @notice Point the protocol at a different attestation adapter.
    function setAttestationAdapter(IAttestationAdapter adapter_) external onlyOwner {
        if (address(adapter_) == address(0)) revert TradeTypes.ZeroAddress();
        attestationAdapter = adapter_;
        emit AttestationAdapterChanged(address(adapter_), adapter_.proofKind());
    }

    /// @notice Require cryptographic proof for every cross-chain event.
    function setRequireProofBacked(bool required) external onlyOwner {
        requireProofBacked = required;
        emit ProofRequirementChanged(required);
    }

    /// @notice Allow or disallow an account to verify suppliers via the off-chain KYB path.
    function setSupplierVerifier(address verifier, bool allowed) external onlyOwner {
        if (verifier == address(0)) revert TradeTypes.ZeroAddress();
        supplierVerifiers[verifier] = allowed;
        emit SupplierVerifierSet(verifier, allowed);
    }

    // ---------------------------------------------------------------------
    // Lifecycle
    // ---------------------------------------------------------------------

    /// @notice Create a trade application.
    /// @param supplier Counterparty supplying the goods.
    /// @param tradeValue Full value of the goods, in settlement-token units.
    /// @param collateral Buyer contribution. Must be greater than zero and less than `tradeValue`;
    ///        a fully collateralised trade needs no financing and an uncollateralised one is out
    ///        of scope for this protocol.
    /// @param interestBps Fixed simple interest over the term, in basis points of the financed sum.
    /// @param termDays Days from disbursement to maturity.
    /// @param metadataHash keccak256 over the off-chain document set. Documents live off-chain;
    ///        only their digest is anchored here.
    function createTrade(
        address supplier,
        uint256 tradeValue,
        uint256 collateral,
        uint16 interestBps,
        uint16 termDays,
        bytes32 metadataHash
    ) external returns (uint256 tradeId) {
        if (supplier == address(0)) revert TradeTypes.ZeroAddress();
        if (supplier == msg.sender) revert InvalidCounterparty();
        if (tradeValue == 0) revert TradeTypes.ZeroAmount();
        if (collateral == 0 || collateral >= tradeValue) revert TradeTypes.InvalidTerms();
        if (termDays == 0) revert TradeTypes.InvalidTerms();

        tradeId = nextTradeId++;
        uint256 financing = tradeValue - collateral;

        _trades[tradeId] = TradeTypes.Trade({
            id: tradeId,
            buyer: msg.sender,
            supplier: supplier,
            financier: address(0),
            terms: TradeTypes.Terms({
                tradeValue: tradeValue,
                collateral: collateral,
                financing: financing,
                interestBps: interestBps,
                termDays: termDays
            }),
            state: TradeTypes.TradeState.APPLICATION,
            createdAt: uint64(block.timestamp),
            fundedAt: 0,
            maturityAt: 0,
            metadataHash: metadataHash
        });

        _credit[msg.sender].tradesAsBuyer += 1;
        _credit[msg.sender].volumeTransacted += tradeValue;

        emit TradeCreated(
            tradeId,
            msg.sender,
            supplier,
            tradeValue,
            collateral,
            financing,
            interestBps,
            termDays,
            metadataHash
        );
        emit TradeStateChanged(
            tradeId,
            TradeTypes.TradeState.APPLICATION,
            TradeTypes.TradeState.APPLICATION,
            msg.sender
        );
    }

    error InvalidCounterparty();

    /// @notice Mark the supplier verified through the off-chain KYB path.
    /// @dev The alternative is `advanceWithAttestation` with a SUPPLIER_VERIFIED event proved from
    ///      a source-chain registry. Both are supported because supplier identity is the one step
    ///      in this lifecycle that is genuinely off-chain for most corridors today.
    function verifySupplier(uint256 tradeId) external {
        if (!supplierVerifiers[msg.sender]) revert NotSupplierVerifier(msg.sender);
        TradeTypes.Trade storage t = _mustExist(tradeId);
        _assertState(t, TradeTypes.TradeState.APPLICATION);

        _setState(t, TradeTypes.TradeState.SUPPLIER_VERIFIED);
        emit SupplierVerified(tradeId, t.supplier, false);
    }

    /// @notice Buyer deposits collateral, which is locked in the vault for the life of the trade.
    /// @dev The buyer must have approved `collateralVault` for the collateral amount.
    function depositCollateral(uint256 tradeId) external nonReentrant {
        TradeTypes.Trade storage t = _mustExist(tradeId);
        _assertParty(t, TradeTypes.Party.BUYER);
        _assertState(t, TradeTypes.TradeState.SUPPLIER_VERIFIED);

        collateralVault.lock(tradeId, msg.sender, t.terms.collateral);
        _setState(t, TradeTypes.TradeState.COLLATERAL_LOCKED);
    }

    /// @notice Financier commits the full financing amount into escrow.
    /// @dev Financing is all-or-nothing in the MVP: partial or syndicated participation would
    ///      change the repayment split and the default waterfall, which is more protocol than this
    ///      prototype needs to demonstrate. The financier must have approved `escrow`.
    function commitFinancing(uint256 tradeId) external nonReentrant {
        TradeTypes.Trade storage t = _mustExist(tradeId);
        _assertState(t, TradeTypes.TradeState.COLLATERAL_LOCKED);
        if (msg.sender == t.buyer || msg.sender == t.supplier) revert SelfFinancingForbidden();

        t.financier = msg.sender;
        escrow.deposit(tradeId, msg.sender, t.terms.financing);

        _credit[msg.sender].tradesFinanced += 1;
        _credit[msg.sender].volumeFinanced += t.terms.financing;

        _setState(t, TradeTypes.TradeState.FINANCING_APPROVED);
        emit FinancingCommitted(tradeId, msg.sender, t.terms.financing);
    }

    /// @notice Release escrowed financing to the supplier and start the repayment clock.
    /// @dev Callable by the buyer or the financier. The supplier cannot trigger their own payment.
    function releaseFunds(uint256 tradeId) external nonReentrant {
        TradeTypes.Trade storage t = _mustExist(tradeId);
        _assertState(t, TradeTypes.TradeState.FINANCING_APPROVED);
        if (msg.sender != t.buyer && msg.sender != t.financier) {
            revert TradeTypes.NotAuthorized(tradeId, msg.sender, TradeTypes.Party.BUYER);
        }

        uint256 amount = escrow.releaseToSupplier(tradeId, t.supplier);
        (, uint64 maturityAt) = repayments.open(
            tradeId, t.financier, t.terms.financing, t.terms.interestBps, t.terms.termDays
        );

        t.fundedAt = uint64(block.timestamp);
        t.maturityAt = maturityAt;

        _setState(t, TradeTypes.TradeState.FUNDED);
        emit FundsReleased(tradeId, t.supplier, amount);
    }

    /// @notice Advance a trade using a cross-chain event recorded by the attestation adapter.
    /// @dev Permissionless. The submitter's identity is irrelevant because every property that
    ///      matters is read back from the adapter's record, and — in the USC adapter — was itself
    ///      established by verifying a proof against the block-prover precompile.
    /// @param attestationId Id returned by `UscAttestationAdapter.submitProof` or, on a testnet
    ///        deployment, `DemoAttestationAdapter.assertEvent`.
    function advanceWithAttestation(uint256 tradeId, bytes32 attestationId) external {
        TradeTypes.Trade storage t = _mustExist(tradeId);
        TradeTypes.Attestation memory a = _consumeAttestation(tradeId, attestationId);

        TradeTypes.TradeState target;
        if (a.kind == TradeTypes.EventKind.SUPPLIER_VERIFIED) {
            _assertState(t, TradeTypes.TradeState.APPLICATION);
            target = TradeTypes.TradeState.SUPPLIER_VERIFIED;
        } else if (a.kind == TradeTypes.EventKind.SHIPMENT_CONFIRMED) {
            _assertState(t, TradeTypes.TradeState.FUNDED);
            target = TradeTypes.TradeState.SHIPPED;
        } else if (a.kind == TradeTypes.EventKind.DELIVERY_CONFIRMED) {
            _assertState(t, TradeTypes.TradeState.SHIPPED);
            target = TradeTypes.TradeState.DELIVERED;
        } else {
            revert UnexpectedEventKind(a.kind);
        }

        _setState(t, target);
        if (target == TradeTypes.TradeState.SUPPLIER_VERIFIED) {
            emit SupplierVerified(tradeId, t.supplier, true);
        }
        emit AttestationApplied(tradeId, attestationId, a.kind, a.proofKind, target);
    }

    /// @notice Buyer repays against the outstanding obligation.
    /// @dev Accepts partial repayments. The buyer must have approved `repayments`. Double
    ///      repayment is prevented by the manager clamping to the outstanding balance and by the
    ///      REPAID state closing the door on further calls.
    function repay(uint256 tradeId, uint256 amount) external nonReentrant {
        TradeTypes.Trade storage t = _mustExist(tradeId);
        _assertParty(t, TradeTypes.Party.BUYER);
        if (
            t.state != TradeTypes.TradeState.DELIVERED && t.state != TradeTypes.TradeState.REPAYING
        ) {
            revert TradeTypes.InvalidState(tradeId, t.state, TradeTypes.TradeState.DELIVERED);
        }
        if (amount == 0) revert NothingToRepay();

        (uint256 applied, uint256 outstandingAfter) = repayments.repay(tradeId, msg.sender, amount);
        _credit[msg.sender].volumeRepaid += applied;

        if (outstandingAfter == 0) {
            _credit[msg.sender].cumulativeRepaymentDays +=
                uint64((block.timestamp - t.fundedAt) / 1 days);
            _setState(t, TradeTypes.TradeState.REPAID);
        } else if (t.state != TradeTypes.TradeState.REPAYING) {
            _setState(t, TradeTypes.TradeState.REPAYING);
        }

        emit TradeRepaid(tradeId, applied, outstandingAfter);
    }

    /// @notice Close a fully repaid trade and return collateral to the buyer.
    function complete(uint256 tradeId) external nonReentrant {
        TradeTypes.Trade storage t = _mustExist(tradeId);
        _assertState(t, TradeTypes.TradeState.REPAID);

        uint256 returned = collateralVault.lockedOf(tradeId);
        collateralVault.release(tradeId, t.buyer);

        _credit[t.buyer].tradesCompleted += 1;
        _setState(t, TradeTypes.TradeState.COMPLETED);
        emit TradeCompleted(tradeId, returned);
    }

    /// @notice Declare a matured, unpaid trade in default and transfer collateral to the financier.
    /// @dev Callable by the financier once past maturity. Collateral only ever covers part of the
    ///      exposure, so the uncovered `shortfall` is emitted rather than hidden: a lender reading
    ///      the event stream should see the real loss, not a settled-looking close.
    function declareDefault(uint256 tradeId) external nonReentrant {
        TradeTypes.Trade storage t = _mustExist(tradeId);
        if (msg.sender != t.financier) {
            revert TradeTypes.NotAuthorized(tradeId, msg.sender, TradeTypes.Party.FINANCIER);
        }
        if (
            t.state != TradeTypes.TradeState.FUNDED && t.state != TradeTypes.TradeState.SHIPPED
                && t.state != TradeTypes.TradeState.DELIVERED
                && t.state != TradeTypes.TradeState.REPAYING
        ) {
            revert TradeTypes.InvalidState(tradeId, t.state, TradeTypes.TradeState.REPAYING);
        }
        if (block.timestamp <= t.maturityAt) revert NotMatured(t.maturityAt);

        uint256 owed = repayments.outstanding(tradeId);
        uint256 seized = collateralVault.lockedOf(tradeId);
        collateralVault.seize(tradeId, t.financier);

        _credit[t.buyer].tradesDefaulted += 1;
        _setState(t, TradeTypes.TradeState.DEFAULTED);
        emit TradeDefaulted(tradeId, seized, owed > seized ? owed - seized : 0);
    }

    /// @notice Cancel a trade before financing is disbursed, refunding whatever has been committed.
    /// @dev Available up to and including FINANCING_APPROVED. Once funds have reached the supplier
    ///      the trade is a real credit exposure and can only end in repayment or default.
    function cancel(uint256 tradeId) external nonReentrant {
        TradeTypes.Trade storage t = _mustExist(tradeId);
        if (msg.sender != t.buyer && msg.sender != owner()) {
            revert TradeTypes.NotAuthorized(tradeId, msg.sender, TradeTypes.Party.BUYER);
        }

        TradeTypes.TradeState s = t.state;
        if (
            s != TradeTypes.TradeState.APPLICATION && s != TradeTypes.TradeState.SUPPLIER_VERIFIED
                && s != TradeTypes.TradeState.COLLATERAL_LOCKED
                && s != TradeTypes.TradeState.FINANCING_APPROVED
        ) {
            revert TradeTypes.InvalidState(tradeId, s, TradeTypes.TradeState.COLLATERAL_LOCKED);
        }

        if (s == TradeTypes.TradeState.FINANCING_APPROVED) {
            escrow.refund(tradeId, t.financier);
        }
        if (collateralVault.lockedOf(tradeId) != 0) {
            collateralVault.release(tradeId, t.buyer);
        }

        _setState(t, TradeTypes.TradeState.CANCELLED);
        emit TradeCancelled(tradeId, msg.sender);
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    function getTrade(uint256 tradeId) external view returns (TradeTypes.Trade memory) {
        return _trades[tradeId];
    }

    function outstandingOf(uint256 tradeId) external view returns (uint256) {
        return repayments.outstanding(tradeId);
    }

    function creditRecordOf(address account) external view returns (CreditRecord memory) {
        return _credit[account];
    }

    /// @notice Total number of trades ever created.
    function tradeCount() external view returns (uint256) {
        return nextTradeId - 1;
    }

    // ---------------------------------------------------------------------
    // Internals
    // ---------------------------------------------------------------------

    /// @dev Reads an attestation, checks it belongs to this trade, is strong enough for the
    ///      deployment's policy, and has not been applied before.
    function _consumeAttestation(uint256 tradeId, bytes32 id)
        private
        returns (TradeTypes.Attestation memory a)
    {
        if (attestationConsumed[id]) revert AttestationAlreadyApplied(id);

        a = attestationAdapter.getAttestation(id);
        if (a.proofKind == TradeTypes.ProofKind.NONE) revert TradeTypes.AttestationMismatch();
        if (a.tradeId != tradeId) revert TradeTypes.AttestationMismatch();
        if (requireProofBacked && a.proofKind != TradeTypes.ProofKind.USC_PROOF) {
            revert TradeTypes.ProofRequired();
        }

        attestationConsumed[id] = true;
    }

    function _mustExist(uint256 tradeId) private view returns (TradeTypes.Trade storage t) {
        t = _trades[tradeId];
        if (t.id == 0) revert TradeTypes.UnknownTrade(tradeId);
    }

    function _assertState(TradeTypes.Trade storage t, TradeTypes.TradeState required) private view {
        if (t.state != required) revert TradeTypes.InvalidState(t.id, t.state, required);
    }

    function _assertParty(TradeTypes.Trade storage t, TradeTypes.Party required) private view {
        address expected = required == TradeTypes.Party.BUYER
            ? t.buyer
            : (required == TradeTypes.Party.SUPPLIER ? t.supplier : t.financier);
        if (msg.sender != expected) {
            revert TradeTypes.NotAuthorized(t.id, msg.sender, required);
        }
    }

    function _setState(TradeTypes.Trade storage t, TradeTypes.TradeState to) private {
        TradeTypes.TradeState from = t.state;
        t.state = to;
        emit TradeStateChanged(t.id, from, to, msg.sender);
    }
}
