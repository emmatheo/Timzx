'use client';

import {useQuery} from '@tanstack/react-query';
import {useMemo} from 'react';

import {fetchTradeMetadata} from '@/lib/services/trade-metadata';
import type {OnChainTrade, TradeView} from '@/types/trade';

/**
 * Joins on-chain trades with their descriptive metadata.
 *
 * The chain read is the source of truth and never waits on Supabase: metadata resolves separately
 * and merges in when it arrives, so a Supabase outage degrades titles to "Trade #n" instead of
 * emptying the dashboard.
 */
export function useTradeViews(
  entries: {trade: OnChainTrade; outstanding: bigint}[],
): TradeView[] {
  const ids = useMemo(() => entries.map((entry) => entry.trade.id), [entries]);
  const key = useMemo(() => ids.map((id) => id.toString()).join(','), [ids]);

  const {data: metadata} = useQuery({
    queryKey: ['trade-metadata', key],
    queryFn: () => fetchTradeMetadata(ids),
    enabled: ids.length > 0,
    staleTime: 60_000,
  });

  return useMemo(
    () =>
      entries.map(({trade, outstanding}) => ({
        chain: trade,
        meta: metadata?.get(trade.id.toString()) ?? null,
        outstanding,
      })),
    [entries, metadata],
  );
}
