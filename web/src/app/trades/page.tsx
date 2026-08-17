'use client';

import {useMemo, useState} from 'react';

import {ButtonLink} from '@/components/ui/button';
import {Card, CardHeader} from '@/components/ui/card';
import {TradeTable} from '@/components/trade/trade-table';
import {cn} from '@/components/ui/cn';
import {useMyTrades} from '@/hooks/use-protocol';
import {useTradeViews} from '@/hooks/use-trade-views';
import {TERMINAL_STATES} from '@/types/trade';

type Filter = 'active' | 'settled' | 'all';

export default function MyTradesPage() {
  const {trades: entries, isLoading} = useMyTrades();
  const views = useTradeViews(entries);
  const [filter, setFilter] = useState<Filter>('active');

  const visible = useMemo(() => {
    if (filter === 'all') return views;
    const settled = filter === 'settled';
    return views.filter(({chain}) => TERMINAL_STATES.includes(chain.state) === settled);
  }, [views, filter]);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">My Trades</h1>
          <p className="mt-1.5 text-[14px] text-ink-muted">
            Every trade where your wallet is the buyer, the supplier or the financier.
          </p>
        </div>
        <ButtonLink href="/trades/new" size="sm">
          Create trade
        </ButtonLink>
      </header>

      <Card>
        <CardHeader
          title="Trade portfolio"
          action={
            <div className="flex rounded-lg border border-line-strong p-0.5">
              {(['active', 'settled', 'all'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  className={cn(
                    'rounded-md px-3 py-1 text-[12.5px] font-medium capitalize transition-colors',
                    filter === value
                      ? 'bg-surface-hover text-ink'
                      : 'text-ink-subtle hover:text-ink',
                  )}
                >
                  {value}
                </button>
              ))}
            </div>
          }
        />
        <TradeTable
          trades={visible}
          isLoading={isLoading}
          emptyTitle={filter === 'settled' ? 'No settled trades' : 'No trades in this view'}
          emptyDescription="Connect a wallet and create a trade, or finance one from the marketplace."
        />
      </Card>
    </div>
  );
}
