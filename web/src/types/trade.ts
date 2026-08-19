/**
 * Domain types mirroring `TradeTypes.sol`.
 *
 * The numeric values are the on-chain enum ordinals and must stay in lockstep with the Solidity
 * declaration order. They are declared as a const object rather than a TS `enum` so the values are
 * visible at the definition site and cannot silently renumber.
 */
import type {Address, Hex} from 'viem';

export const TradeState = {
  APPLICATION: 0,
  SUPPLIER_VERIFIED: 1,
  COLLATERAL_LOCKED: 2,
  FINANCING_APPROVED: 3,
  FUNDED: 4,
  SHIPPED: 5,
  DELIVERED: 6,
  REPAYING: 7,
  REPAID: 8,
  COMPLETED: 9,
  DEFAULTED: 10,
  CANCELLED: 11,
} as const;

export type TradeStateValue = (typeof TradeState)[keyof typeof TradeState];

export const EventKind = {
  UNKNOWN: 0,
  SUPPLIER_VERIFIED: 1,
  SHIPMENT_CONFIRMED: 2,
  DELIVERY_CONFIRMED: 3,
  REPAYMENT_SETTLED: 4,
} as const;

export type EventKindValue = (typeof EventKind)[keyof typeof EventKind];

/**
 * How an attestation was established. Read from the chain, never inferred from configuration.
 * `USC_PROOF` is the only non-null value: the protocol acts on proved events and nothing else.
 */
export const ProofKind = {
  NONE: 0,
  USC_PROOF: 1,
} as const;

export type ProofKindValue = (typeof ProofKind)[keyof typeof ProofKind];

/** Ordered lifecycle used to render the timeline. Terminal states are handled separately. */
export const LIFECYCLE_STEPS: readonly TradeStateValue[] = [
  TradeState.APPLICATION,
  TradeState.SUPPLIER_VERIFIED,
  TradeState.COLLATERAL_LOCKED,
  TradeState.FINANCING_APPROVED,
  TradeState.FUNDED,
  TradeState.SHIPPED,
  TradeState.DELIVERED,
  TradeState.REPAYING,
  TradeState.REPAID,
  TradeState.COMPLETED,
];

export const TERMINAL_STATES: readonly TradeStateValue[] = [
  TradeState.COMPLETED,
  TradeState.DEFAULTED,
  TradeState.CANCELLED,
];

export interface TradeTerms {
  tradeValue: bigint;
  collateral: bigint;
  financing: bigint;
  interestBps: number;
  termDays: number;
}

/** A trade exactly as the chain reports it. No off-chain fields are mixed in here. */
export interface OnChainTrade {
  id: bigint;
  buyer: Address;
  supplier: Address;
  financier: Address;
  terms: TradeTerms;
  state: TradeStateValue;
  createdAt: number;
  fundedAt: number;
  maturityAt: number;
  metadataHash: Hex;
}

/**
 * Off-chain descriptive metadata, stored in Supabase and keyed by on-chain trade id.
 * Kept in a separate type from {@link OnChainTrade} so it is always obvious at a call site whether
 * a value is authoritative or merely descriptive.
 */
export interface TradeMetadata {
  tradeId: string;
  title: string;
  commodity: string;
  industry: string;
  originCountry: string;
  destinationCountry: string;
  supplierName: string;
  buyerName: string;
  incoterms: string | null;
  summary: string | null;
}

/** A trade with its metadata attached, as the UI consumes it. */
export interface TradeView {
  chain: OnChainTrade;
  meta: TradeMetadata | null;
  outstanding: bigint;
}

export interface Attestation {
  id: Hex;
  tradeId: bigint;
  kind: EventKindValue;
  proofKind: ProofKindValue;
  sourceChainKey: number;
  sourceHeight: bigint;
  sourceTxHash: Hex;
  emitter: Address;
  recordedAt: number;
}

export interface CreditRecord {
  tradesAsBuyer: number;
  tradesCompleted: number;
  tradesDefaulted: number;
  tradesFinanced: number;
  volumeTransacted: bigint;
  volumeFinanced: bigint;
  volumeRepaid: bigint;
  cumulativeRepaymentDays: number;
}

export type Role = 'buyer' | 'supplier' | 'financier';

export interface DocumentRecord {
  id: string;
  tradeId: string;
  name: string;
  documentType: string;
  contentHash: Hex | null;
  storageCid: string | null;
  uploadedBy: Address | null;
  uploadedAt: string;
  /** True when `contentHash` matches the trade's on-chain `metadataHash` set. */
  anchored: boolean;
}
