'use client';

import {useCallback, useMemo, useState} from 'react';
import {usePublicClient, useWalletClient} from 'wagmi';
import type {Hex} from 'viem';

import {creditcoin} from '@/lib/config/chains';
import {contractAddresses, uscConfig} from '@/lib/config/env';
import {
  createAttestationService,
  type AttestationProgress,
  type AttestationRequest,
  type AttestationResult,
} from '@/lib/services/attestation';
import {useToast} from '@/components/ui/toast';
import {explorerTxUrl} from '@/lib/config/chains';

/**
 * Drives one attestation attempt.
 *
 * The hook is deliberately thin: it owns progress state and error reporting, and delegates every
 * decision about what an attestation *is* to the service. That keeps the "is this proved?" logic
 * in one testable place instead of spread across components.
 */
export function useAttestation() {
  const publicClient = usePublicClient({chainId: creditcoin.id});
  const {data: walletClient} = useWalletClient({chainId: creditcoin.id});
  const {push} = useToast();

  const [progress, setProgress] = useState<AttestationProgress>({stage: 'idle', message: ''});

  const service = useMemo(() => {
    if (!publicClient || !walletClient) return null;
    return createAttestationService({publicClient, walletClient});
  }, [publicClient, walletClient]);

  const attest = useCallback(
    async (request: Omit<AttestationRequest, 'emitter'> & {emitter?: Hex}): Promise<AttestationResult | null> => {
      if (!service) {
        push({kind: 'error', title: 'Connect a wallet to submit an attestation'});
        return null;
      }
      const emitter = (request.emitter ?? contractAddresses.sourceEmitter) as Hex | null;
      if (!emitter) {
        push({
          kind: 'error',
          title: 'Source emitter not configured',
          description:
            'Set NEXT_PUBLIC_SOURCE_EMITTER_ADDRESS to the TradeEventEmitter deployed on the source chain.',
        });
        return null;
      }

      try {
        const result = await service.attest(
          {...request, emitter: emitter as `0x${string}`},
          setProgress,
        );
        push({
          kind: 'success',
          title: 'Attestation recorded',
          href: explorerTxUrl(creditcoin.id, result.txHash) ?? undefined,
        });
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Attestation failed.';
        setProgress({stage: 'failed', message});
        push({kind: 'error', title: 'Attestation failed', description: message});
        return null;
      }
    },
    [push, service],
  );

  return {
    attest,
    progress,
    reset: () => setProgress({stage: 'idle', message: ''}),
    capabilities: service?.capabilities ?? null,
    sourceChainKey: uscConfig.sourceChainKey,
  };
}
