'use client';

import {useMemo, useState} from 'react';
import {Plus} from 'lucide-react';

import {ButtonLink} from '@/components/ui/button';
import {Card} from '@/components/ui/card';
import {cn} from '@/components/ui/cn';
import {TradeTable} from '@/components/trade/trade-table';
import {useMyTrades} from '@/hooks/use-protocol';
import {useTradeViews} from '@/hooks/use-trade-views';
import {TERMINAL_STATES, TradeState, type TradeStateValue} from '@/types/trade';

/**
 * Trade filters.
 *
 * Named for the question a counterparty is actually asking — "what is waiting on money?", "what is
 * moving?" — rather than mirroring the enum. Each maps to explicit states so the tab labels can
 * read naturally without the filter becoming vague about what it includes.
 */
const FILTERS: {id: string; label: string; states: readonly TradeStateValue[] | null}[] = [
  {id: 'all', label: 'All', states: null},
  {
    id: 'funded',
    label: 'Funded',
    states: [TradeState.FINANCING_APPROVED, TradeState.FUNDED],
  },
  {id: 'in-transit', label: 'In transit', states: [TradeState.SHIPPED, TradeState.DELIVERED]},
  {id: 'repaying', label: 'Repaying', states: [TradeState.REPAYING, TradeState.REPAID]},
  {
    id: 'completed',
    label: 'Completed',
    states: [TradeState.COMPLETED, TradeState.DEFAULTED, TradeState.CANCELLED],
  },
];

export default function MyTradesPage() {
  const {trades: entries, isLoading, error} = useMyTrades();
  const views = useTradeViews(entries);
  const [active, setActive] = useState('all');

  const counts = useMemo(() => {
    const result: Record<string, number> = {};
    for (const filter of FILTERS) {
      result[filter.id] = filter.states
        ? views.filter(({chain}) => filter.states?.includes(chain.state)).length
        : views.length;
    }
    return result;
  }, [views]);

  const visible = useMemo(() => {
    const filter = FILTERS.find((entry) => entry.id === active);
    if (!filter?.states) return views;
    return views.filter(({chain}) => filter.states?.includes(chain.state));
  }, [views, active]);

  const openCount = views.filter(({chain}) => !TERMINAL_STATES.includes(chain.state)).length;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">My Trades</h1>
          <p className="mt-1.5 text-[14px] text-ink-muted">
            {openCount} open · every trade where your wallet is buyer, supplier or financier.
          </p>
        </div>
        <ButtonLink href="/trades/new" size="sm" icon={Plus}>
          Create trade
        </ButtonLink>
      </header>

      {/* Scrollable on narrow screens so the tab row never wraps into two ragged lines. */}
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex min-w-max gap-1 border-b border-line">
          {FILTERS.map((filter) => {
            const isActive = filter.id === active;
            return (
              <button
                key={filter.id}
                type="button"
                onClick={() => setActive(filter.id)}
                className={cn(
                  '-mb-px border-b-2 px-3 pb-2.5 text-[13.5px] font-medium whitespace-nowrap transition-colors',
                  isActive
                    ? 'border-accent text-accent'
                    : 'border-transparent text-ink-muted hover:text-ink',
                )}
              >
                {filter.label}
                <span
                  className={cn(
                    'numeric ml-1.5 text-[12px]',
                    isActive ? 'text-accent' : 'text-ink-subtle',
                  )}
                >
                  {counts[filter.id] ?? 0}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <Card>
        <TradeTable
          trades={visible}
          isLoading={isLoading}
          error={error}
          emptyTitle="No trades in this view"
          emptyDescription="Create a trade, or finance one from the marketplace, to see it here."
        />
      </Card>
    </div>
  );
}
