import {ArrowDown, Blocks, Cpu, FileCheck2, Link2, ShieldCheck, Workflow} from 'lucide-react';

import {cn} from '@/components/ui/cn';

/**
 * The architecture diagram on the Developer page.
 *
 * Drawn with layout and inline SVG rather than an image so it stays legible at any width, scales
 * with the type, and can label each hop with the concrete artefact that moves across it — which is
 * the part that makes the flow real rather than decorative.
 */
const stages = [
  {
    icon: Blocks,
    title: 'Source chain',
    detail: 'TradeEventEmitter emits ShipmentConfirmed on Ethereum Sepolia.',
    artefact: 'Event log',
  },
  {
    icon: Link2,
    title: 'Attestcoin / USC',
    detail: 'Attestors observe the block and attest it on Creditcoin via the gossip protocol.',
    artefact: 'Block attestation',
  },
  {
    icon: FileCheck2,
    title: 'Proof generation',
    detail: 'Proof API returns a Merkle proof against the tx root plus a continuity proof.',
    artefact: 'Merkle + continuity proof',
  },
  {
    icon: Cpu,
    title: 'Verification',
    detail: 'Block-prover precompile 0x…0FD2 verifies inclusion in the same transaction.',
    artefact: 'verify() -> true',
  },
  {
    icon: ShieldCheck,
    title: 'Binding',
    detail:
      'UscAttestationAdapter reads the proven bytes at QueryBuilder offsets and binds them to a trade.',
    artefact: 'Attestation record',
  },
  {
    icon: Workflow,
    title: 'State transition',
    detail: 'TradeFinance advances FUNDED to SHIPPED. No relayer, no oracle, no trusted quorum.',
    artefact: 'TradeStateChanged',
  },
] as const;

export function VerificationFlow({className}: {className?: string}) {
  return (
    <ol className={cn('space-y-0', className)}>
      {stages.map((stage, index) => (
        <li key={stage.title}>
          <div className="flex gap-4 rounded-xl border border-line bg-surface-raised p-4">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-accent/25 bg-accent-soft">
              <stage.icon className="size-4 text-accent" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-[14px] font-semibold text-ink">{stage.title}</h3>
                <code className="rounded border border-line bg-surface-overlay px-1.5 py-0.5 font-mono text-[11px] text-ink-muted">
                  {stage.artefact}
                </code>
              </div>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">{stage.detail}</p>
            </div>
          </div>
          {index < stages.length - 1 ? (
            <div className="flex justify-center py-1.5" aria-hidden>
              <ArrowDown className="size-4 text-ink-subtle" />
            </div>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
