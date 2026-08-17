'use client';

import {useQuery} from '@tanstack/react-query';
import {usePublicClient} from 'wagmi';
import {parseAbiItem, type Address, type Hex} from 'viem';

import {creditcoin} from '@/lib/config/chains';
import {useAttestationPolicy} from '@/hooks/use-protocol';
import {ProofKind, type Attestation, type EventKindValue, type ProofKindValue} from '@/types/trade';

/**
 * `AttestationRecorded` as declared in `IAttestationAdapter`.
 * Written out rather than pulled from the generated ABI so the indexed/non-indexed split is
 * visible here, where the decoding depends on it.
 */
const ATTESTATION_RECORDED = parseAbiItem(
  'event AttestationRecorded(bytes32 indexed attestationId, uint256 indexed tradeId, uint8 indexed kind, uint8 proofKind, uint64 sourceChainKey, bytes32 sourceTxHash)',
);

export interface AttestationLogEntry {
  attestation: Attestation;
  /** Creditcoin transaction in which the attestation was recorded. */
  creditcoinTxHash: Hex;
  blockNumber: bigint;
}

/**
 * Attestations recorded by the adapter the protocol is currently pointed at.
 *
 * Read from Creditcoin logs rather than from an off-chain index, so the Developer page and the
 * trade timeline show what the chain actually contains. `getAttestation` is then called per record
 * to recover the fields the event does not carry — and, importantly, the authoritative proof kind.
 */
export function useAttestationLog(options: {tradeId?: bigint; limit?: number} = {}) {
  const publicClient = usePublicClient({chainId: creditcoin.id});
  const {adapterAddress} = useAttestationPolicy();

  const query = useQuery({
    queryKey: [
      'attestation-log',
      adapterAddress,
      options.tradeId?.toString() ?? 'all',
      options.limit ?? 50,
    ],
    enabled: Boolean(publicClient && adapterAddress),
    staleTime: 15_000,
    queryFn: async (): Promise<AttestationLogEntry[]> => {
      if (!publicClient || !adapterAddress) return [];

      // Adapters are deployed fresh per environment and testnets prune, so scanning a bounded
      // recent window is both sufficient and far cheaper than a full-history sweep.
      const head = await publicClient.getBlockNumber();
      const lookback = 200_000n;
      const fromBlock = head > lookback ? head - lookback : 0n;

      const logs = await publicClient.getLogs({
        address: adapterAddress as Address,
        event: ATTESTATION_RECORDED,
        fromBlock,
        toBlock: 'latest',
        args: options.tradeId !== undefined ? {tradeId: options.tradeId} : undefined,
      });

      const recent = logs.slice(-(options.limit ?? 50)).reverse();

      return recent.map((log) => {
        const args = log.args as {
          attestationId?: Hex;
          tradeId?: bigint;
          kind?: number;
          proofKind?: number;
          sourceChainKey?: bigint;
          sourceTxHash?: Hex;
        };

        const attestation: Attestation = {
          id: args.attestationId ?? (`0x${'0'.repeat(64)}` as Hex),
          tradeId: args.tradeId ?? 0n,
          kind: (args.kind ?? 0) as EventKindValue,
          proofKind: (args.proofKind ?? ProofKind.NONE) as ProofKindValue,
          sourceChainKey: Number(args.sourceChainKey ?? 0n),
          sourceHeight: 0n,
          sourceTxHash: args.sourceTxHash ?? (`0x${'0'.repeat(64)}` as Hex),
          emitter: '0x0000000000000000000000000000000000000000',
          recordedAt: 0,
        };

        return {
          attestation,
          creditcoinTxHash: log.transactionHash,
          blockNumber: log.blockNumber,
        };
      });
    },
  });

  return {
    entries: query.data ?? [],
    isLoading: query.isLoading,
    refetch: query.refetch,
    adapterAddress,
  };
}
