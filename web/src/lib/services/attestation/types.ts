/**
 * The USC integration seam.
 *
 * Everything the app knows about establishing a cross-chain event goes through
 * {@link AttestationService}. Its single implementation builds a Merkle and continuity proof and
 * submits it for on-chain verification.
 *
 * The rule this interface exists to enforce: a plain API request is not a proof. The result
 * carries the `ProofKind` read back from the adapter after confirmation, never a value the client
 * chose, so nothing downstream can present an unproved event as a verified one.
 */
import type {Address, Hex} from 'viem';

import type {EventKindValue, ProofKindValue} from '@/types/trade';

/** A proof as returned by the Creditcoin proof-generation API. */
export interface MerkleProofEntry {
  hash: Hex;
  isLeft: boolean;
}

export interface MerkleProof {
  root: Hex;
  siblings: MerkleProofEntry[];
}

export interface ContinuityProof {
  lowerEndpointDigest: Hex;
  roots: Hex[];
}

/**
 * Response shape of `GET /api/v1/proof-by-tx/{chainKey}/{txHash}` on the Creditcoin proof API.
 * Mirrors the `ContinuityResponse` type in the gluwa usc-sdk package.
 */
export interface ProofPayload {
  chainKey: number;
  headerNumber: number;
  txIndex: number;
  txHash: Hex;
  txBytes: Hex;
  merkleProof: MerkleProof;
  continuityProof: ContinuityProof;
  cached: boolean;
  generatedAt: string;
}

/** Byte offsets into `txBytes`, computed off-chain, that the adapter reads after verifying. */
export interface QueryFieldOffsets {
  rxStatus: number;
  logAddress: number;
  topic0: number;
  tradeId: number;
}

export interface AttestationRequest {
  tradeId: bigint;
  kind: EventKindValue;
  /** Transaction on the source chain that emitted the event. */
  sourceTxHash: Hex;
  /** Index of the matching log within that transaction's receipt. */
  logIndex: number;
  /** Emitting contract on the source chain. */
  emitter: Address;
}

/** What an implementation can actually do, so the UI can describe it accurately. */
export interface AttestationCapabilities {
  /** The proof kind this service produces. Always `USC_PROOF`. */
  produces: ProofKindValue;
  /** Adapter contract this service submits to, or null when unconfigured. */
  adapterAddress: Address | null;
  /** Human-readable reason the service is unavailable, or null when it is ready. */
  unavailableReason: string | null;
}

/** Progress of a single attestation attempt, surfaced step by step in the UI. */
export type AttestationStage =
  | 'idle'
  | 'checking-attestation'
  | 'fetching-proof'
  | 'awaiting-signature'
  | 'submitting'
  | 'confirmed'
  | 'failed';

export interface AttestationProgress {
  stage: AttestationStage;
  message: string;
  /** Populated once the proof has been fetched, so the UI can show what is being submitted. */
  proof?: ProofPayload;
}

export interface AttestationResult {
  /** Canonical attestation id, to be passed to `TradeFinance.advanceWithAttestation`. */
  attestationId: Hex;
  /** Creditcoin transaction that recorded the attestation. */
  txHash: Hex;
  /** Read back from the adapter after confirmation, never assumed. */
  proofKind: ProofKindValue;
}

export interface AttestationService {
  readonly capabilities: AttestationCapabilities;

  /**
   * Establish a cross-chain event and record it on Creditcoin.
   * @param onProgress Called as the attempt moves through its stages.
   */
  attest(
    request: AttestationRequest,
    onProgress?: (progress: AttestationProgress) => void,
  ): Promise<AttestationResult>;
}

/** Thrown when a service is asked to do something its configuration does not support. */
export class AttestationUnavailableError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'AttestationUnavailableError';
  }
}
