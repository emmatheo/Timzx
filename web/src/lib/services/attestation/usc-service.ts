/**
 * The real attestation path: build a proof, verify it on Creditcoin, record the result.
 */
import type {Address, Hex, PublicClient, WalletClient} from 'viem';

import {uscAttestationAdapterAbi} from '@/lib/abi';
import {precompiles} from '@/lib/config/chains';
import {
  defaultFieldOffsetResolver,
  type FieldOffsetResolver,
} from './field-offsets';
import {ProofApiClient} from './proof-api';
import {
  AttestationUnavailableError,
  type AttestationCapabilities,
  type AttestationProgress,
  type AttestationRequest,
  type AttestationResult,
  type AttestationService,
} from './types';
import {ProofKind, type ProofKindValue} from '@/types/trade';
import {eventTopicFor} from './topics';

/** Minimal ChainInfo ABI: only what this service needs before spending gas. */
const chainInfoAbi = [
  {
    inputs: [
      {internalType: 'uint64', name: 'chainKey', type: 'uint64'},
      {internalType: 'uint64', name: 'targetHeight', type: 'uint64'},
    ],
    name: 'is_height_attested',
    outputs: [{internalType: 'bool', name: 'isAttested', type: 'bool'}],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export interface UscAttestationServiceOptions {
  publicClient: PublicClient;
  walletClient: WalletClient;
  adapterAddress: Address | null;
  proofApiUrl: string | null;
  sourceChainKey: number;
  offsetResolver?: FieldOffsetResolver;
}

export class UscAttestationService implements AttestationService {
  private readonly offsetResolver: FieldOffsetResolver;

  constructor(private readonly options: UscAttestationServiceOptions) {
    this.offsetResolver = options.offsetResolver ?? defaultFieldOffsetResolver();
  }

  get capabilities(): AttestationCapabilities {
    const missing: string[] = [];
    if (!this.options.adapterAddress) missing.push('USC adapter address');
    if (!this.options.proofApiUrl) missing.push('proof API URL');

    return {
      produces: ProofKind.USC_PROOF,
      adapterAddress: this.options.adapterAddress,
      unavailableReason:
        missing.length > 0 ? `Not configured: ${missing.join(', ')}.` : null,
    };
  }

  async attest(
    request: AttestationRequest,
    onProgress?: (progress: AttestationProgress) => void,
  ): Promise<AttestationResult> {
    const {adapterAddress, proofApiUrl, sourceChainKey, publicClient, walletClient} = this.options;
    if (!adapterAddress || !proofApiUrl) {
      throw new AttestationUnavailableError(
        this.capabilities.unavailableReason ?? 'USC attestation is not configured.',
      );
    }

    const report = (progress: AttestationProgress) => onProgress?.(progress);

    // 1. Fetch the inclusion proof. The API only has one once the attestor set has attested the
    //    block, so a failure here usually means "not attested yet" rather than "no such tx".
    report({stage: 'fetching-proof', message: 'Requesting inclusion proof from the proof API'});
    const proofApi = new ProofApiClient(proofApiUrl);
    const proof = await proofApi.getProof(sourceChainKey, request.sourceTxHash);

    // 2. Confirm on Creditcoin itself that the height is attested, before asking for a signature.
    //    Cheaper to find out here than to have the adapter revert after the user has signed.
    report({
      stage: 'checking-attestation',
      message: `Checking attestation of source height ${proof.headerNumber}`,
      proof,
    });
    const attested = await publicClient.readContract({
      address: precompiles.chainInfo,
      abi: chainInfoAbi,
      functionName: 'is_height_attested',
      args: [BigInt(sourceChainKey), BigInt(proof.headerNumber)],
    });
    if (!attested) {
      throw new AttestationUnavailableError(
        `Source height ${proof.headerNumber} is not yet attested on Creditcoin. Wait for the attestor set and retry.`,
      );
    }

    // 3. Resolve where in the proven bytes the fields live. Never guessed.
    const offsets = await this.offsetResolver.resolve({
      chainKey: sourceChainKey,
      txBytes: proof.txBytes,
      emitter: request.emitter,
      topic0: eventTopicFor(request.kind),
      logIndex: request.logIndex,
    });

    // 4. Submit. The adapter re-verifies everything on-chain; nothing here is trusted.
    report({stage: 'awaiting-signature', message: 'Confirm the proof submission in your wallet', proof});
    const account = walletClient.account;
    if (!account) throw new AttestationUnavailableError('No wallet account connected.');

    const {request: simulated} = await publicClient.simulateContract({
      account,
      address: adapterAddress,
      abi: uscAttestationAdapterAbi,
      functionName: 'submitProof',
      args: [
        {
          tradeId: request.tradeId,
          kind: request.kind,
          sourceChainKey: BigInt(sourceChainKey),
          sourceHeight: BigInt(proof.headerNumber),
          sourceTxHash: request.sourceTxHash,
          logIndex: request.logIndex,
          encodedTransaction: proof.txBytes,
          merkleProof: {
            root: proof.merkleProof.root,
            siblings: proof.merkleProof.siblings,
          },
          continuityProof: {
            lowerEndpointDigest: proof.continuityProof.lowerEndpointDigest,
            roots: proof.continuityProof.roots,
          },
          fields: offsets,
        },
      ],
    });

    const txHash = await walletClient.writeContract(simulated);
    report({stage: 'submitting', message: 'Waiting for Creditcoin confirmation', proof});
    await publicClient.waitForTransactionReceipt({hash: txHash});

    // 5. Read the recorded attestation back from the chain. The proof kind reported to the UI is
    //    the one the adapter stamped, never the one this client hoped for.
    const attestationId = await publicClient.readContract({
      address: adapterAddress,
      abi: uscAttestationAdapterAbi,
      functionName: 'attestationId',
      args: [BigInt(sourceChainKey), request.sourceTxHash, request.logIndex],
    });
    const recorded = await publicClient.readContract({
      address: adapterAddress,
      abi: uscAttestationAdapterAbi,
      functionName: 'getAttestation',
      args: [attestationId],
    });

    report({stage: 'confirmed', message: 'Proof verified and recorded on Creditcoin', proof});
    return {
      attestationId,
      txHash,
      proofKind: recorded.proofKind as ProofKindValue,
    };
  }
}

export type {Hex};
