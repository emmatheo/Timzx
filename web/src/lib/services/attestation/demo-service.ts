/**
 * The testnet path: record an operator assertion, proving nothing.
 *
 * This exists so the lifecycle can be demonstrated end to end before a source-chain emitter and
 * proof pipeline are live. It is a real on-chain write to a real contract — the transaction hash
 * it returns is genuine — but the event it records was asserted, not proved, and the adapter
 * stamps `DEMO_OPERATOR` on it so no part of the UI can present it as a USC verification.
 */
import type {Address, PublicClient, WalletClient} from 'viem';

import {demoAttestationAdapterAbi} from '@/lib/abi';
import {
  AttestationUnavailableError,
  type AttestationCapabilities,
  type AttestationProgress,
  type AttestationRequest,
  type AttestationResult,
  type AttestationService,
} from './types';
import {ProofKind, type ProofKindValue} from '@/types/trade';

export interface DemoAttestationServiceOptions {
  publicClient: PublicClient;
  walletClient: WalletClient;
  adapterAddress: Address | null;
  sourceChainKey: number;
}

export class DemoAttestationService implements AttestationService {
  constructor(private readonly options: DemoAttestationServiceOptions) {}

  get capabilities(): AttestationCapabilities {
    return {
      produces: ProofKind.DEMO_OPERATOR,
      adapterAddress: this.options.adapterAddress,
      unavailableReason: this.options.adapterAddress
        ? null
        : 'Not configured: demo adapter address.',
    };
  }

  async attest(
    request: AttestationRequest,
    onProgress?: (progress: AttestationProgress) => void,
  ): Promise<AttestationResult> {
    const {adapterAddress, publicClient, walletClient, sourceChainKey} = this.options;
    if (!adapterAddress) {
      throw new AttestationUnavailableError('Demo adapter address is not configured.');
    }
    const account = walletClient.account;
    if (!account) throw new AttestationUnavailableError('No wallet account connected.');

    onProgress?.({
      stage: 'awaiting-signature',
      message: 'Confirm the demo assertion in your wallet. This does not generate a proof.',
    });

    // The current source-chain head is recorded as the height so the record points at a real
    // block, but note that nothing about that block is verified — no proof is built or checked.
    const height = await publicClient.getBlockNumber().catch(() => 0n);

    const {request: simulated} = await publicClient.simulateContract({
      account,
      address: adapterAddress,
      abi: demoAttestationAdapterAbi,
      functionName: 'assertEvent',
      args: [
        request.tradeId,
        request.kind,
        BigInt(sourceChainKey),
        height,
        request.sourceTxHash,
        request.logIndex,
        request.emitter,
      ],
    });

    const txHash = await walletClient.writeContract(simulated);
    onProgress?.({stage: 'submitting', message: 'Waiting for Creditcoin confirmation'});
    await publicClient.waitForTransactionReceipt({hash: txHash});

    const attestationId = await publicClient.readContract({
      address: adapterAddress,
      abi: demoAttestationAdapterAbi,
      functionName: 'attestationId',
      args: [BigInt(sourceChainKey), request.sourceTxHash, request.logIndex],
    });
    const recorded = await publicClient.readContract({
      address: adapterAddress,
      abi: demoAttestationAdapterAbi,
      functionName: 'getAttestation',
      args: [attestationId],
    });

    onProgress?.({
      stage: 'confirmed',
      message: 'Demo assertion recorded. No cryptographic proof was produced.',
    });

    return {
      attestationId,
      txHash,
      proofKind: recorded.proofKind as ProofKindValue,
    };
  }
}
