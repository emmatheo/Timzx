import type {LucideIcon} from 'lucide-react';
import {TrendingDown, TrendingUp} from 'lucide-react';

import {cn} from './cn';

/**
 * Dashboard metric tile.
 *
 * `source` is required rather than optional on purpose: every number states where it came from, so
 * a reader always knows whether they are looking at chain state or an indexed aggregate of it.
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  source,
  delta,
  className,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  source: 'On-chain' | 'Indexed';
  delta?: {value: string; direction: 'up' | 'down'};
  className?: string;
}) {
  const DeltaIcon = delta?.direction === 'down' ? TrendingDown : TrendingUp;

  return (
    <div
      className={cn(
        'rounded-[14px] border border-line bg-surface-raised px-5 py-4',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-[12px] font-medium tracking-wide text-ink-subtle uppercase">
          {label}
        </span>
        <Icon className="size-4 shrink-0 text-ink-subtle" aria-hidden />
      </div>
      <p className="numeric mt-3 text-[26px] leading-none font-semibold text-ink">{value}</p>
      <div className="mt-3 flex items-center gap-2">
        <span className="text-[11px] font-medium tracking-wide text-ink-subtle uppercase">
          {source}
        </span>
        {delta ? (
          <span
            className={cn(
              'inline-flex items-center gap-1 text-[12px] font-medium',
              delta.direction === 'up' ? 'text-positive' : 'text-danger',
            )}
          >
            <DeltaIcon className="size-3" aria-hidden />
            {delta.value}
          </span>
        ) : null}
      </div>
    </div>
  );
}
