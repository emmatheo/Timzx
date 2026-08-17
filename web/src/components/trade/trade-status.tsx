import {Badge} from '@/components/ui/badge';
import {statePresentation} from '@/lib/trade-state';
import type {TradeStateValue} from '@/types/trade';

/** Canonical status pill. Every table, card and header uses this, never a bespoke label. */
export function TradeStatus({state, className}: {state: TradeStateValue; className?: string}) {
  const presentation = statePresentation(state);
  return (
    <Badge tone={presentation.tone} icon={presentation.icon} className={className}>
      {presentation.label}
    </Badge>
  );
}
