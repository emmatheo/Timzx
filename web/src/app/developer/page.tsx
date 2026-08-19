'use client';

import {Activity, Terminal} from 'lucide-react';
import {useReadContract} from 'wagmi';

import {AttestationCard} from '@/components/attestation/attestation-card';
import {VerificationFlow} from '@/components/attestation/verification-flow';
import {Badge} from '@/components/ui/badge';
import {Card, CardBody, CardHeader} from '@/components/ui/card';
import {Copyable} from '@/components/ui/copyable';
import {EmptyState, SkeletonRows} from '@/components/ui/states';
import {useAttestationLog} from '@/hooks/use-attestation-log';
import {useAttestationAdapter} from '@/hooks/use-protocol';
import {creditcoin, explorerAddressUrl, precompiles, sourceChain} from '@/lib/config/chains';
import {contractAddresses, isProofPipelineConfigured, uscConfig} from '@/lib/config/env';
import {shortenAddress} from '@/lib/format';
import {eventKindPresentation, proofKindPresentation} from '@/lib/trade-state';
import {EventKind, ProofKind, type ProofKindValue} from '@/types/trade';

/** ChainInfo precompile: the authoritative chainKey to chainId mapping for this network. */
const chainInfoAbi = [
  {
    inputs: [],
    name: 'get_supported_chains',
    outputs: [
      {
        components: [
          {internalType: 'uint64', name: 'chainKey', type: 'uint64'},
          {internalType: 'uint64', name: 'chainId', type: 'uint64'},
          {internalType: 'bytes', name: 'chainName', type: 'bytes'},
          {internalType: 'uint8', name: 'chainEncoding', type: 'uint8'},
        ],
        internalType: 'struct ChainInfo[]',
        name: 'chains',
        type: 'tuple[]',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

/**
 * Developer page.
 *
 * Shows the verification architecture and what this deployment is actually doing, read from the
 * chain. The supported-chains table comes straight from the ChainInfo precompile, which is the
 * only authority on the chainKey/chainId mapping — that mapping differs per Creditcoin
 * environment, so a mismatch with configuration is called out rather than hidden.
 */
export default function DeveloperPage() {
  const {entries, isLoading} = useAttestationLog({limit: 25});
  const adapter = useAttestationAdapter();

  const {data: supportedChains, isError: chainsError} = useReadContract({
    address: precompiles.chainInfo,
    abi: chainInfoAbi,
    chainId: creditcoin.id,
    functionName: 'get_supported_chains',
  });

  const configuredKey = uscConfig.sourceChainKey;
  const matched = supportedChains?.find((chain) => Number(chain.chainKey) === configuredKey);
  const proofPresentation = proofKindPresentation(adapter.adapterProofKind as ProofKindValue);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Cross-Chain Verification</h1>
        <p className="mt-1.5 max-w-3xl text-[14px] leading-relaxed text-ink-muted">
          How a real-world event on another chain becomes a state transition on Creditcoin, and what
          this particular deployment is configured to prove.
        </p>
      </header>

      <Card>
        <CardHeader
          title="Deployment posture"
          description="Read from the contracts, not from configuration."
        />
        <CardBody className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Fact
            label="Adapter proof kind"
            value={proofPresentation.label}
            tone={adapter.adapterProofKind === ProofKind.USC_PROOF ? 'positive' : undefined}
          />
          <Fact
            label="Unproved events"
            value="Rejected on-chain"
            tone="positive"
          />
          <Fact
            label="Proof pipeline"
            value={isProofPipelineConfigured ? 'Configured' : 'Incomplete'}
            tone={isProofPipelineConfigured ? 'positive' : 'warning'}
          />
          <Fact label="Configured source chain key" value={String(configuredKey)} />
        </CardBody>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader
            title="Verification flow"
            description="Every hop, and the artefact that crosses it."
          />
          <CardBody>
            <VerificationFlow />
          </CardBody>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader
              title="Precompiles and contracts"
              description="Addresses this deployment talks to."
            />
            <CardBody className="space-y-2.5 text-[13px]">
              <AddressRow label="Block prover (0x…0FD2)" address={precompiles.blockProver} />
              <AddressRow label="Chain info (0x…0FD3)" address={precompiles.chainInfo} />
              <AddressRow label="TradeFinance" address={contractAddresses.tradeFinance} />
              <AddressRow label="Active adapter" address={adapter.adapterAddress} />
              <AddressRow label="Collateral vault" address={contractAddresses.collateralVault} />
              <AddressRow label="Trade escrow" address={contractAddresses.tradeEscrow} />
              <AddressRow label="Repayment manager" address={contractAddresses.repaymentManager} />
              <AddressRow
                label={`Source emitter (${sourceChain.name})`}
                address={contractAddresses.sourceEmitter}
                chainId={sourceChain.id}
              />
              <div className="flex items-start justify-between gap-3 border-t border-line pt-2.5">
                <span className="text-ink-subtle">Proof API</span>
                <span className="max-w-[60%] truncate text-right font-mono text-[12px] text-ink-muted">
                  {uscConfig.proofApiUrl ?? 'Not configured'}
                </span>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Supported source chains"
              description="From the ChainInfo precompile. chainKey is not chainId."
            />
            <CardBody>
              {chainsError ? (
                <p className="text-[13px] leading-relaxed text-ink-muted">
                  Could not read the ChainInfo precompile. This is expected when the app is pointed
                  at a network that is not a Creditcoin USC chain.
                </p>
              ) : !supportedChains || supportedChains.length === 0 ? (
                <p className="text-[13px] text-ink-muted">No supported chains reported.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[13px]">
                    <thead>
                      <tr className="border-b border-line">
                        <th className="py-2 pr-3 text-[11px] tracking-wide text-ink-subtle uppercase">
                          Key
                        </th>
                        <th className="py-2 pr-3 text-[11px] tracking-wide text-ink-subtle uppercase">
                          Chain id
                        </th>
                        <th className="py-2 pr-3 text-[11px] tracking-wide text-ink-subtle uppercase">
                          Name
                        </th>
                        <th className="py-2 text-[11px] tracking-wide text-ink-subtle uppercase">
                          Enc.
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {supportedChains.map((chain) => (
                        <tr key={chain.chainKey.toString()} className="border-b border-line last:border-0">
                          <td className="numeric py-2 pr-3 font-medium text-ink">
                            {chain.chainKey.toString()}
                          </td>
                          <td className="numeric py-2 pr-3 text-ink-muted">
                            {chain.chainId.toString()}
                          </td>
                          <td className="py-2 pr-3 font-mono text-[12px] text-ink-muted">
                            {decodeChainName(chain.chainName)}
                          </td>
                          <td className="numeric py-2 text-ink-muted">{chain.chainEncoding}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {supportedChains && supportedChains.length > 0 && !matched ? (
                <p className="mt-3 rounded-lg border border-warning/30 bg-warning-soft px-3 py-2 text-[12.5px] leading-relaxed text-ink-muted">
                  Configured source chain key {configuredKey} is not in this network&apos;s supported
                  list. Proof submission will revert until NEXT_PUBLIC_SOURCE_CHAIN_KEY matches a key
                  above.
                </p>
              ) : null}
            </CardBody>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader
          title="Recent attestations"
          description="Read from AttestationRecorded logs on Creditcoin."
          action={<Badge tone="info" icon={Activity}>{entries.length} records</Badge>}
        />
        {isLoading ? (
          <SkeletonRows rows={3} />
        ) : entries.length === 0 ? (
          <EmptyState
            icon={Terminal}
            title="No attestations recorded"
            description="Advance a trade past FUNDED to record the first cross-chain event on this deployment."
          />
        ) : (
          <CardBody className="grid gap-3 lg:grid-cols-2">
            {entries.map((entry) => (
              <AttestationCard
                key={`${entry.attestation.id}-${entry.blockNumber}`}
                attestation={entry.attestation}
                creditcoinTxHash={entry.creditcoinTxHash}
                destination="TradeFinance"
                result={resultFor(entry.attestation.kind)}
              />
            ))}
          </CardBody>
        )}
      </Card>
    </div>
  );
}

function resultFor(kind: number): string {
  const label = eventKindPresentation(kind as 0 | 1 | 2 | 3 | 4).label;
  if (kind === EventKind.SHIPMENT_CONFIRMED) return 'Trade advanced to SHIPPED';
  if (kind === EventKind.DELIVERY_CONFIRMED) return 'Trade advanced to DELIVERED';
  if (kind === EventKind.SUPPLIER_VERIFIED) return 'Trade advanced to SUPPLIER_VERIFIED';
  return `${label} recorded`;
}

function decodeChainName(raw: `0x${string}`): string {
  try {
    const bytes = raw.slice(2).match(/.{1,2}/g) ?? [];
    return bytes.map((byte) => String.fromCharCode(Number.parseInt(byte, 16))).join('');
  } catch {
    return raw;
  }
}

function Fact({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'positive' | 'warning';
}) {
  return (
    <div>
      <p className="text-[12px] font-medium tracking-wide text-ink-subtle uppercase">{label}</p>
      <p
        className={
          tone === 'positive'
            ? 'mt-1 text-[14px] font-semibold text-positive'
            : tone === 'warning'
              ? 'mt-1 text-[14px] font-semibold text-warning'
              : 'mt-1 text-[14px] font-semibold text-ink'
        }
      >
        {value}
      </p>
    </div>
  );
}

function AddressRow({
  label,
  address,
  chainId = creditcoin.id,
}: {
  label: string;
  address: string | null;
  chainId?: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-ink-subtle">{label}</span>
      {address ? (
        <Copyable
          value={address}
          display={shortenAddress(address)}
          href={explorerAddressUrl(chainId, address)}
        />
      ) : (
        <span className="text-[12px] text-ink-subtle">Not configured</span>
      )}
    </div>
  );
}
