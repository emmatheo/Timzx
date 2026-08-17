import {Badge} from '@/components/ui/badge';
import {Copyable} from '@/components/ui/copyable';
import {cn} from '@/components/ui/cn';
import {creditcoin, explorerTxUrl, sourceChain} from '@/lib/config/chains';
import {formatRelative, shortenAddress, shortenHash} from '@/lib/format';
import {eventKindPresentation, proofKindPresentation} from '@/lib/trade-state';
import {ProofKind, type Attestation} from '@/types/trade';

/**
 * One attestation, as the Developer page and trade detail both render it.
 *
 * The proof kind shown here is read from the adapter contract, not inferred from configuration,
 * so a deployment cannot be made to look like it is proving things when it is not.
 */
export function AttestationCard({
  attestation,
  creditcoinTxHash,
  destination,
  result,
  className,
}: {
  attestation: Attestation;
  creditcoinTxHash?: `0x${string}` | null;
  destination?: string;
  result?: string;
  className?: string;
}) {
  const event = eventKindPresentation(attestation.kind);
  const proof = proofKindPresentation(attestation.proofKind);
  const proved = attestation.proofKind === ProofKind.USC_PROOF;

  return (
    <div
      className={cn(
        'rounded-[14px] border bg-surface-raised p-4',
        proved ? 'border-positive/25' : 'border-warning/25',
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              'flex size-8 items-center justify-center rounded-lg border',
              proved ? 'border-positive/30 bg-positive-soft' : 'border-warning/30 bg-warning-soft',
            )}
          >
            <event.icon
              className={cn('size-4', proved ? 'text-positive' : 'text-warning')}
              aria-hidden
            />
          </span>
          <div>
            <p className="font-mono text-[13.5px] font-medium text-ink">{event.label}</p>
            <p className="text-[12px] text-ink-subtle">
              Trade #{attestation.tradeId.toString()} · {formatRelative(attestation.recordedAt)}
            </p>
          </div>
        </div>
        <Badge tone={proof.tone}>{proof.label}</Badge>
      </div>

      <p className="mt-3 text-[12px] leading-relaxed text-ink-muted">{proof.detail}</p>

      <dl className="mt-3 grid gap-x-6 gap-y-2 border-t border-line pt-3 text-[12px] sm:grid-cols-2">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-ink-subtle">Source chain key</dt>
          <dd className="numeric text-ink-muted">{attestation.sourceChainKey}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-ink-subtle">Source height</dt>
          <dd className="numeric text-ink-muted">{attestation.sourceHeight.toString()}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-ink-subtle">Source tx</dt>
          <dd>
            <Copyable
              value={attestation.sourceTxHash}
              display={shortenHash(attestation.sourceTxHash)}
              href={explorerTxUrl(sourceChain.id, attestation.sourceTxHash)}
            />
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-ink-subtle">Emitter</dt>
          <dd className="numeric font-mono text-ink-muted">
            {shortenAddress(attestation.emitter)}
          </dd>
        </div>
        {creditcoinTxHash ? (
          <div className="flex items-center justify-between gap-3">
            <dt className="text-ink-subtle">Creditcoin tx</dt>
            <dd>
              <Copyable
                value={creditcoinTxHash}
                display={shortenHash(creditcoinTxHash)}
                href={explorerTxUrl(creditcoin.id, creditcoinTxHash)}
              />
            </dd>
          </div>
        ) : null}
        {destination ? (
          <div className="flex items-center justify-between gap-3">
            <dt className="text-ink-subtle">Destination</dt>
            <dd className="text-ink-muted">{destination}</dd>
          </div>
        ) : null}
      </dl>

      {result ? (
        <p className="mt-3 rounded-lg border border-line bg-surface-overlay px-3 py-2 text-[12px] text-ink-muted">
          {result}
        </p>
      ) : null}
    </div>
  );
}
