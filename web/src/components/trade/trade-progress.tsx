import {LIFECYCLE_STEPS, TradeState, type TradeStateValue} from '@/types/trade';
import {cn} from '@/components/ui/cn';

/**
 * Compact lifecycle progress, for tables and cards where the full timeline would not fit.
 * Terminal failure states show as a filled danger bar rather than a partial one, because a
 * defaulted trade is finished, not stalled midway.
 */
export function TradeProgress({state, className}: {state: TradeStateValue; className?: string}) {
  const failed = state === TradeState.DEFAULTED;
  const cancelled = state === TradeState.CANCELLED;
  const index = LIFECYCLE_STEPS.indexOf(state);
  const reached = failed || cancelled ? LIFECYCLE_STEPS.length : index + 1;

  return (
    <div className={cn('flex items-center gap-[3px]', className)} aria-hidden>
      {LIFECYCLE_STEPS.map((step, position) => (
        <span
          key={step}
          className={cn(
            'h-1 w-3.5 rounded-full transition-colors',
            position < reached
              ? failed
                ? 'bg-danger'
                : cancelled
                  ? 'bg-line-strong'
                  : 'bg-accent'
              : 'bg-line',
          )}
        />
      ))}
    </div>
  );
}
