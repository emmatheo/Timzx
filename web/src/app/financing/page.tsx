'use client';

import {useMemo, useState} from 'react';
import {AlertTriangle, Landmark, TrendingUp} from 'lucide-react';

import {Badge} from '@/components/ui/badge';
import {Button, ButtonLink} from '@/components/ui/button';
import {Card, CardHeader} from '@/components/ui/card';
import {DataPoint} from '@/components/ui/field';
import {Modal} from '@/components/ui/modal';
import {EmptyState, SkeletonRows} from '@/components/ui/states';
import {StatCard} from '@/components/ui/stat-card';
import {useCreditRecord, useFinanceableTrades, useSettlementToken} from '@/hooks/use-protocol';
import {useTradeActions} from '@/hooks/use-trade-actions';
import {useTradeViews} from '@/hooks/use-trade-views';
import {
  assessRisk,
  collateralRatio,
  impliedApr,
  loanToValue,
  totalRepayable,
} from '@/lib/finance';
import {formatMoney, formatMoneyCompact, formatPercent, shortenAddress} from '@/lib/format';
import type {TradeView} from '@/types/trade';

/**
 * Financing desk.
 *
 * A financier is committing real capital, so the confirmation modal states the full obligation —
 * outlay, expected return, term, and the risk the collateral does not cover — before anything is
 * signed. No single-click commitment anywhere on this page.
 */
export default function FinancingPage() {
  const {trades: entries, isLoading, refetch} = useFinanceableTrades();
  const views = useTradeViews(entries);
  const {balance, symbol} = useSettlementToken();
  const [selected, setSelected] = useState<TradeView | null>(null);
  const actions = useTradeActions(refetch);

  const totals = useMemo(() => {
    let requested = 0n;
    for (const {chain} of views) requested += chain.terms.financing;
    return {requested, count: views.length};
  }, [views]);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Financing</h1>
        <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-ink-muted">
          Trades with collateral already locked, waiting on capital. Committing sends funds to an
          escrow contract that can only pay the supplier or refund you.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Open opportunities"
          value={totals.count.toString()}
          icon={Landmark}
          source="On-chain"
        />
        <StatCard
          label="Capital requested"
          value={formatMoneyCompact(totals.requested)}
          icon={TrendingUp}
          source="On-chain"
        />
        <StatCard
          label="Your settlement balance"
          value={`${formatMoneyCompact(balance)} ${symbol}`}
          icon={Landmark}
          source="On-chain"
        />
      </section>

      <Card>
        <CardHeader
          title="Financing opportunities"
          description="Collateral is verified on-chain before a trade appears here."
        />
        {isLoading ? (
          <SkeletonRows rows={3} />
        ) : views.length === 0 ? (
          <EmptyState
            icon={Landmark}
            title="No trades awaiting financing"
            description="A trade appears here once its buyer has locked collateral."
            action={
              <ButtonLink href="/marketplace" size="sm" variant="secondary">
                Browse marketplace
              </ButtonLink>
            }
          />
        ) : (
          <div className="divide-y divide-line">
            {views.map((view) => (
              <OpportunityRow
                key={view.chain.id.toString()}
                view={view}
                onFinance={() => setSelected(view)}
              />
            ))}
          </div>
        )}
      </Card>

      <FinanceModal
        view={selected}
        onClose={() => setSelected(null)}
        pending={actions.state.pending}
        onConfirm={async () => {
          if (!selected) return;
          const ok = await actions.commitFinancing(
            selected.chain.id,
            selected.chain.terms.financing,
          );
          if (ok) setSelected(null);
        }}
      />
    </div>
  );
}

function OpportunityRow({view, onFinance}: {view: TradeView; onFinance: () => void}) {
  const {chain, meta} = view;
  const {record} = useCreditRecord(chain.buyer);
  const risk = assessRisk(
    record ?? {
      tradesAsBuyer: 0,
      tradesCompleted: 0,
      tradesDefaulted: 0,
      cumulativeRepaymentDays: 0,
    },
  );

  const riskTone =
    risk.band === 'low'
      ? 'positive'
      : risk.band === 'moderate'
        ? 'info'
        : risk.band === 'elevated'
          ? 'warning'
          : 'neutral';

  return (
    <div className="px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold text-ink">
            {meta?.title ?? `Trade #${chain.id}`}
          </h3>
          <p className="mt-0.5 text-[13px] text-ink-muted">
            {meta ? `${meta.originCountry} to ${meta.destinationCountry} · ` : ''}
            Buyer {shortenAddress(chain.buyer)}
          </p>
        </div>
        <Badge tone={riskTone}>
          TImx risk: {risk.band === 'insufficient-data' ? 'no history' : risk.band}
        </Badge>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <DataPoint label="Trade value" value={formatMoney(chain.terms.tradeValue)} />
        <DataPoint label="Collateral" value={formatMoney(chain.terms.collateral)} />
        <DataPoint label="Requested" value={formatMoney(chain.terms.financing)} />
        <DataPoint label="LTV" value={formatPercent(loanToValue(chain.terms))} />
        <DataPoint
          label="Expected repayment"
          value={formatMoney(totalRepayable(chain.terms.financing, chain.terms.interestBps))}
        />
        <DataPoint
          label="Term"
          value={`${chain.terms.termDays}d`}
          hint={`${formatPercent(impliedApr(chain.terms.interestBps, chain.terms.termDays))} implied APR`}
        />
      </dl>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" icon={Landmark} onClick={onFinance}>
          Finance Trade
        </Button>
        <ButtonLink href={`/trades/${chain.id}`} size="sm" variant="secondary">
          View detail
        </ButtonLink>
      </div>
    </div>
  );
}

function FinanceModal({
  view,
  onClose,
  onConfirm,
  pending,
}: {
  view: TradeView | null;
  onClose: () => void;
  onConfirm: () => void;
  pending: boolean;
}) {
  if (!view) return null;
  const {chain, meta} = view;
  const repayment = totalRepayable(chain.terms.financing, chain.terms.interestBps);
  const uncovered = chain.terms.financing - chain.terms.collateral;

  return (
    <Modal
      open
      onClose={onClose}
      title="Confirm financing commitment"
      description={meta?.title ?? `Trade #${chain.id}`}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={onConfirm} loading={pending}>
            Commit {formatMoney(chain.terms.financing)}
          </Button>
        </>
      }
    >
      <dl className="grid grid-cols-2 gap-4">
        <DataPoint label="You commit now" value={formatMoney(chain.terms.financing, {precise: true})} />
        <DataPoint label="You receive at maturity" value={formatMoney(repayment, {precise: true})} />
        <DataPoint label="Term" value={`${chain.terms.termDays} days`} />
        <DataPoint
          label="Collateral backing"
          value={`${formatMoney(chain.terms.collateral)} (${formatPercent(collateralRatio(chain.terms))})`}
        />
      </dl>

      <div className="mt-4 rounded-lg border border-warning/30 bg-warning-soft px-3 py-2.5">
        <div className="flex gap-2.5">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          <div>
            <p className="text-[13px] font-medium text-ink">This exposure is not fully secured</p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">
              Collateral covers {formatMoney(chain.terms.collateral)} of your{' '}
              {formatMoney(chain.terms.financing)} commitment. If the buyer defaults you may claim
              the collateral, leaving {formatMoney(uncovered)} of principal plus all interest
              unrecovered.
            </p>
          </div>
        </div>
      </div>

      <p className="mt-4 text-[12.5px] leading-relaxed text-ink-subtle">
        Funds move to the TradeEscrow contract. They can only be released to the verified supplier
        once the buyer or you trigger disbursement, or refunded to you if the trade is cancelled
        first. Two transactions may be required: one to approve the token, one to commit.
      </p>
    </Modal>
  );
}
