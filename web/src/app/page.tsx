'use client';

import {ArrowRight, Boxes, CircleDollarSign, Landmark, Plus, Wallet} from 'lucide-react';
import {useMemo} from 'react';

import {ButtonLink} from '@/components/ui/button';
import {Card, CardBody, CardHeader} from '@/components/ui/card';
import {StatCard} from '@/components/ui/stat-card';
import {TradeTable} from '@/components/trade/trade-table';
import {useAllTrades, useMyTrades} from '@/hooks/use-protocol';
import {useTradeViews} from '@/hooks/use-trade-views';
import {formatMoneyCompact} from '@/lib/format';
import {isChainConfigured} from '@/lib/config/env';
import {TERMINAL_STATES, TradeState} from '@/types/trade';

export default function DashboardPage() {
  const {trades: allEntries, isLoading} = useAllTrades();
  const {trades: myEntries, isLoading: myLoading} = useMyTrades();
  const myTrades = useTradeViews(myEntries);

  // Portfolio figures are summed from chain state, so they are consistent with the trade rows
  // below by construction rather than by a separately maintained aggregate.
  const stats = useMemo(() => {
    let volume = 0n;
    let financed = 0n;
    let repaid = 0n;
    let active = 0;

    for (const {trade} of allEntries) {
      volume += trade.terms.tradeValue;
      if (trade.state >= TradeState.FINANCING_APPROVED && trade.state !== TradeState.CANCELLED) {
        financed += trade.terms.financing;
      }
      if (trade.state === TradeState.REPAID || trade.state === TradeState.COMPLETED) {
        repaid += trade.terms.financing;
      }
      if (!TERMINAL_STATES.includes(trade.state)) active += 1;
    }

    return {volume, financed, repaid, active};
  }, [allEntries]);

  const activeTrades = useMemo(
    () => myTrades.filter(({chain}) => !TERMINAL_STATES.includes(chain.state)),
    [myTrades],
  );

  return (
    <div className="space-y-6">
      <section className="hero-gradient overflow-hidden rounded-[18px] border border-line px-6 py-10 sm:px-10 sm:py-14">
        <div className="max-w-2xl">
          <p className="text-[12px] font-medium tracking-[0.12em] text-accent uppercase">
            Cross-border trade finance
          </p>
          <h1 className="mt-3 text-[32px] leading-[1.1] font-semibold tracking-tight text-ink sm:text-[42px]">
            Global Trade. Onchain Trust.
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ink-muted">
            Programmable financing for cross-border trade. Buyers post collateral, financiers commit
            capital, and shipment and delivery advance the trade only once the underlying event has
            been verified across chains.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <ButtonLink href="/trades/new" size="lg" icon={Plus}>
              Create Trade
            </ButtonLink>
            <ButtonLink href="/marketplace" size="lg" variant="secondary" iconRight={ArrowRight}>
              Explore Marketplace
            </ButtonLink>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total trade volume"
          value={formatMoneyCompact(stats.volume)}
          icon={Boxes}
          source="On-chain"
        />
        <StatCard
          label="Active trades"
          value={stats.active.toString()}
          icon={CircleDollarSign}
          source="On-chain"
        />
        <StatCard
          label="Total financing"
          value={formatMoneyCompact(stats.financed)}
          icon={Landmark}
          source="On-chain"
        />
        <StatCard
          label="Repaid amount"
          value={formatMoneyCompact(stats.repaid)}
          icon={Wallet}
          source="On-chain"
        />
      </section>

      <Card>
        <CardHeader
          title="My Active Trades"
          description={
            isChainConfigured
              ? 'Trades where your wallet is the buyer, supplier or financier.'
              : 'Contracts are not deployed on this network yet. Deploy with Foundry and set the addresses in .env.local.'
          }
          action={
            <ButtonLink href="/trades/new" size="sm" variant="secondary" icon={Plus}>
              New trade
            </ButtonLink>
          }
        />
        <TradeTable
          trades={activeTrades}
          isLoading={isLoading || myLoading}
          emptyTitle="No active trades"
          emptyDescription="Create a trade application, or finance one from the marketplace, to see it here."
          emptyAction={
            <ButtonLink href="/trades/new" size="sm">
              Create trade
            </ButtonLink>
          }
        />
      </Card>

      <Card>
        <CardHeader
          title="How a trade settles"
          description="Every step below is enforced by the contracts, not by the interface."
        />
        <CardBody className="grid gap-4 sm:grid-cols-3">
          {[
            {
              title: 'Collateral and capital',
              body: 'The buyer locks collateral in a vault and a financier commits the remainder into escrow. Neither can be withdrawn at will.',
            },
            {
              title: 'Verified movement',
              body: 'Shipment and delivery originate on another chain. The trade only advances once that event is proved on Creditcoin.',
            },
            {
              title: 'Settlement and history',
              body: 'Repayment flows straight to the financier, collateral returns to the buyer, and the outcome becomes part of a verifiable record.',
            },
          ].map((item) => (
            <div key={item.title}>
              <h3 className="text-[14px] font-semibold text-ink">{item.title}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">{item.body}</p>
            </div>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}
