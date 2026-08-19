'use client';

import {Check, Circle, Loader2, XCircle} from 'lucide-react';

import {Badge} from '@/components/ui/badge';
import {Copyable} from '@/components/ui/copyable';
import {cn} from '@/components/ui/cn';
import {creditcoin, explorerTxUrl, sourceChain} from '@/lib/config/chains';
import {formatDateTime, shortenHash} from '@/lib/format';
import {proofKindPresentation, statePresentation} from '@/lib/trade-state';
import {
  LIFECYCLE_STEPS,
  ProofKind,
  TradeState,
  type Attestation,
  type OnChainTrade,
  type TradeStateValue,
} from '@/types/trade';

/**
 * Evidence attached to a lifecycle step.
 *
 * A step is either something the protocol did on Creditcoin (a transaction), or something the
 * protocol accepted from another chain (an attestation). The two are rendered differently and
 * never merged, because "we did this" and "we were convinced this happened elsewhere" are
 * different claims and a reader is entitled to tell them apart at a glance.
 */
export interface TimelineEvidence {
  /** Creditcoin transaction that produced this state, when known. */
  creditcoinTxHash?: `0x${string}`;
  /** Cross-chain attestation that authorised this step, when one was involved. */
  attestation?: Attestation;
  /** Actor who performed the step. */
  actor?: string;
  timestamp?: number;
}

const ACTOR_BY_STATE: Partial<Record<TradeStateValue, string>> = {
  [TradeState.APPLICATION]: 'Buyer',
  [TradeState.SUPPLIER_VERIFIED]: 'Verifier',
  [TradeState.COLLATERAL_LOCKED]: 'Buyer',
  [TradeState.FINANCING_APPROVED]: 'Financier',
  [TradeState.FUNDED]: 'Buyer',
  [TradeState.SHIPPED]: 'Logistics (source chain)',
  [TradeState.DELIVERED]: 'Logistics (source chain)',
  [TradeState.REPAYING]: 'Buyer',
  [TradeState.REPAID]: 'Buyer',
  [TradeState.COMPLETED]: 'Protocol',
};

export function TradeTimeline({
  trade,
  evidence,
}: {
  trade: OnChainTrade;
  evidence: Partial<Record<TradeStateValue, TimelineEvidence>>;
}) {
  const currentIndex = LIFECYCLE_STEPS.indexOf(trade.state);
  const failed = trade.state === TradeState.DEFAULTED;
  const cancelled = trade.state === TradeState.CANCELLED;

  return (
    <ol className="relative">
      {LIFECYCLE_STEPS.map((step, index) => {
        const presentation = statePresentation(step);
        const reached = !failed && !cancelled && index <= currentIndex;
        const active = index === currentIndex && !failed && !cancelled;
        const stepEvidence = evidence[step];
        const isLast = index === LIFECYCLE_STEPS.length - 1;

        return (
          <li key={step} className="relative flex gap-4 pb-6 last:pb-0">
            {/* Connector */}
            {!isLast ? (
              <span
                className={cn(
                  'absolute top-8 left-[15px] h-[calc(100%-2rem)] w-px',
                  reached && index < currentIndex ? 'bg-accent/45' : 'bg-line',
                )}
                aria-hidden
              />
            ) : null}

            <span
              className={cn(
                'relative z-10 mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border',
                active
                  ? 'border-accent bg-accent-soft'
                  : reached
                    ? 'border-accent/40 bg-accent-soft'
                    : 'border-line bg-surface-overlay',
              )}
            >
              {active ? (
                <Loader2 className="size-3.5 animate-spin text-accent" aria-hidden />
              ) : reached ? (
                <Check className="size-3.5 text-accent" aria-hidden />
              ) : (
                <Circle className="size-2.5 text-ink-subtle" aria-hidden />
              )}
            </span>

            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <h3
                  className={cn(
                    'text-[14px] font-semibold',
                    reached ? 'text-ink' : 'text-ink-subtle',
                  )}
                >
                  {index + 1}. {presentation.label}
                </h3>
                {active ? (
                  <Badge tone="accent">Current</Badge>
                ) : reached ? null : (
                  <Badge tone="neutral">Pending</Badge>
                )}
              </div>

              <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
                {presentation.description}
              </p>

              {reached ? (
                <div className="mt-2.5 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-ink-subtle">
                    <span>Actor: {stepEvidence?.actor ?? ACTOR_BY_STATE[step] ?? '—'}</span>
                    {stepEvidence?.timestamp ? (
                      <span>{formatDateTime(stepEvidence.timestamp)}</span>
                    ) : null}
                  </div>

                  {stepEvidence?.creditcoinTxHash ? (
                    <div className="flex flex-wrap items-center gap-2 text-[12px]">
                      <span className="text-ink-subtle">Creditcoin tx</span>
                      <Copyable
                        value={stepEvidence.creditcoinTxHash}
                        display={shortenHash(stepEvidence.creditcoinTxHash)}
                        href={explorerTxUrl(creditcoin.id, stepEvidence.creditcoinTxHash)}
                      />
                    </div>
                  ) : null}

                  {stepEvidence?.attestation ? (
                    <AttestationEvidence attestation={stepEvidence.attestation} />
                  ) : null}
                </div>
              ) : null}
            </div>
          </li>
        );
      })}

      {failed || cancelled ? (
        <li className="relative flex gap-4">
          <span
            className={cn(
              'relative z-10 mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border',
              failed ? 'border-danger/50 bg-danger-soft' : 'border-line bg-surface-overlay',
            )}
          >
            <XCircle
              className={cn('size-3.5', failed ? 'text-danger' : 'text-ink-subtle')}
              aria-hidden
            />
          </span>
          <div className="pt-1">
            <h3 className="text-[14px] font-semibold text-ink">
              {statePresentation(trade.state).label}
            </h3>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
              {statePresentation(trade.state).description}
            </p>
          </div>
        </li>
      ) : null}
    </ol>
  );
}

/** Shows how a cross-chain step was established, including when it was not proved at all. */
function AttestationEvidence({attestation}: {attestation: Attestation}) {
  const proof = proofKindPresentation(attestation.proofKind);
  const isProved = attestation.proofKind === ProofKind.USC_PROOF;

  return (
    <div
      className={cn(
        'mt-2 rounded-lg border px-3 py-2.5',
        isProved ? 'border-positive/25 bg-positive-soft' : 'border-warning/25 bg-warning-soft',
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={proof.tone}>{proof.label}</Badge>
        <span className="text-[11px] tracking-wide text-ink-subtle uppercase">
          Source chain key {attestation.sourceChainKey}
        </span>
      </div>
      <p className="mt-1.5 text-[12px] leading-relaxed text-ink-muted">{proof.detail}</p>
      {attestation.sourceTxHash &&
      attestation.sourceTxHash !== `0x${'0'.repeat(64)}` ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[12px]">
          <span className="text-ink-subtle">Source tx</span>
          <Copyable
            value={attestation.sourceTxHash}
            display={shortenHash(attestation.sourceTxHash)}
            href={explorerTxUrl(sourceChain.id, attestation.sourceTxHash)}
          />
        </div>
      ) : null}
    </div>
  );
}
