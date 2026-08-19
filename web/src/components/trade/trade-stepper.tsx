import {Check, CircleDollarSign, FileText, PackageCheck, Ship, Wallet, X} from 'lucide-react';
import type {LucideIcon} from 'lucide-react';

import {cn} from '@/components/ui/cn';
import {TradeState, type TradeStateValue} from '@/types/trade';

/**
 * Horizontal milestone tracker.
 *
 * The lifecycle has twelve states, which is the right resolution for the detail timeline and far
 * too much for a card. This collapses it to the five moments a counterparty actually asks about —
 * created, funded, shipped, delivered, repaid — so a row of trades can be scanned at a glance.
 * The full sequence remains on the trade detail page; nothing is hidden, only summarised.
 */
interface Milestone {
  label: string;
  icon: LucideIcon;
  /** The lifecycle state at which this milestone is complete. */
  reachedAt: TradeStateValue;
}

const MILESTONES: readonly Milestone[] = [
  {label: 'Created', icon: FileText, reachedAt: TradeState.APPLICATION},
  {label: 'Funded', icon: Wallet, reachedAt: TradeState.FUNDED},
  {label: 'Shipped', icon: Ship, reachedAt: TradeState.SHIPPED},
  {label: 'Delivered', icon: PackageCheck, reachedAt: TradeState.DELIVERED},
  {label: 'Repaid', icon: CircleDollarSign, reachedAt: TradeState.REPAID},
];

export function TradeStepper({
  state,
  className,
  showLabels = true,
}: {
  state: TradeStateValue;
  className?: string;
  showLabels?: boolean;
}) {
  const defaulted = state === TradeState.DEFAULTED;
  const cancelled = state === TradeState.CANCELLED;

  // A closed-out trade has no "current" step: it stopped. Rendering one would suggest it is still
  // moving, so terminal failures mark the whole track instead.
  const terminal = defaulted || cancelled;

  return (
    <ol className={cn('flex items-start', className)}>
      {MILESTONES.map((milestone, index) => {
        const complete = !terminal && state >= milestone.reachedAt;
        const isCurrent =
          !terminal &&
          complete &&
          (index === MILESTONES.length - 1 || state < (MILESTONES[index + 1]?.reachedAt ?? 99));
        const isLast = index === MILESTONES.length - 1;
        const Icon = terminal && defaulted ? X : milestone.icon;

        return (
          <li key={milestone.label} className="flex min-w-0 flex-1 items-start last:flex-none">
            <div className="flex min-w-0 flex-col items-center">
              <span
                className={cn(
                  'flex size-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                  defaulted
                    ? 'border-danger/40 bg-danger-soft text-danger'
                    : cancelled
                      ? 'border-line-strong bg-surface-overlay text-ink-subtle'
                      : isCurrent
                        ? 'border-accent bg-accent text-white'
                        : complete
                          ? 'border-positive bg-positive text-white'
                          : 'border-line-strong bg-surface text-ink-subtle',
                )}
              >
                {complete && !isCurrent ? (
                  <Check className="size-3.5" strokeWidth={3} aria-hidden />
                ) : (
                  <Icon className="size-3.5" aria-hidden />
                )}
              </span>
              {showLabels ? (
                <span
                  className={cn(
                    'mt-1.5 max-w-[64px] truncate text-center text-[11px] font-medium',
                    isCurrent ? 'text-accent' : complete ? 'text-ink-muted' : 'text-ink-subtle',
                  )}
                >
                  {milestone.label}
                </span>
              ) : null}
            </div>

            {!isLast ? (
              <span
                className={cn(
                  'mt-[13px] h-0.5 min-w-3 flex-1 rounded-full',
                  !terminal && state > milestone.reachedAt ? 'bg-positive' : 'bg-line-strong',
                )}
                aria-hidden
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
