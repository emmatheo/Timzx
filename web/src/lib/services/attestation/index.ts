import type {PublicClient, WalletClient} from 'viem';

import {contractAddresses, uscConfig} from '@/lib/config/env';
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
 * Builds the attestation service.
 *
 * There is one implementation. Establishing a cross-chain event means fetching an inclusion proof,
 * confirming the source height is attested on Creditcoin, and submitting the proof to the adapter,
 * which verifies it against the block-prover precompile before recording anything. There is no
 * alternative path and no mode switch: an event this pipeline cannot prove is an event the product
 * does not act on.
 */
export function createAttestationService(clients: {
  publicClient: PublicClient;
  walletClient: WalletClient;
}): AttestationService {
  return new UscAttestationService({
    publicClient: clients.publicClient,
    walletClient: clients.walletClient,
    adapterAddress: contractAddresses.uscAdapter,
    proofApiUrl: uscConfig.proofApiUrl,
    sourceChainKey: uscConfig.sourceChainKey,
  });
}
