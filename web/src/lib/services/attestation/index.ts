import type {PublicClient, WalletClient} from 'viem';

import {attestationMode, contractAddresses, uscConfig} from '@/lib/config/env';
import {DemoAttestationService} from './demo-service';
import {UscAttestationService} from './usc-service';
import type {AttestationService} from './types';

export * from './types';
export {ProofApiClient, ProofApiError} from './proof-api';
export {eventTopicFor, eventSignatureFor} from './topics';
export {
  defaultFieldOffsetResolver,
  offsetsFromEnv,
  FieldOffsetsUnavailableError,
} from './field-offsets';

/**
 * Builds the attestation service for the current deployment.
 *
 * The choice is configuration, not code: `NEXT_PUBLIC_ATTESTATION_MODE` decides which
 * implementation the app drives, and everything downstream consumes the same interface. Note that
 * this only picks which contract gets written to — the proof kind shown in the UI is always read
 * back from the chain, so a misconfiguration cannot make a demo record look verified.
 */
export function createAttestationService(clients: {
  publicClient: PublicClient;
  walletClient: WalletClient;
}): AttestationService {
  if (attestationMode === 'usc') {
    return new UscAttestationService({
      publicClient: clients.publicClient,
      walletClient: clients.walletClient,
      adapterAddress: contractAddresses.uscAdapter,
      proofApiUrl: uscConfig.proofApiUrl,
      sourceChainKey: uscConfig.sourceChainKey,
    });
  }

  return new DemoAttestationService({
    publicClient: clients.publicClient,
    walletClient: clients.walletClient,
    adapterAddress: contractAddresses.demoAdapter,
    sourceChainKey: uscConfig.sourceChainKey,
  });
}
