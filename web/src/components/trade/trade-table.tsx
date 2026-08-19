'use client';

import Link from 'next/link';
import {AlertTriangle, ArrowRight, Inbox} from 'lucide-react';

import {EmptyState, SkeletonRows} from '@/components/ui/states';
import {TradeStepper} from './trade-stepper';
import {TradeStatus} from './trade-status';
import {formatDate, formatMoney, shortenAddress} from '@/lib/format';
import {nextStep} from '@/lib/finance';
import type {TradeView} from '@/types/trade';

/**
 * Trade table.
 *
 * Renders as a real table on desktop and as a stacked card list on mobile — not a horizontally
 * squeezed table. Trade rows carry eight fields; below roughly 900px that stops being scannable,
 * so the mobile view reorders them by importance instead of shrinking them.
 */
export function TradeTable({
  trades,
  isLoading,
  error,
  emptyTitle = 'No trades yet',
  emptyDescription,
  emptyAction,
}: {
  trades: TradeView[];
  isLoading?: boolean;
  /** Set when the chain could not be read at all, as opposed to reading zero trades. */
  error?: Error | null;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
}) {
  // Order matters: an unreachable node is not an empty portfolio, and must not be shown as one.
  if (error) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Could not reach the network"
        description={`The Creditcoin RPC did not respond, so trades could not be read. This is a connection problem, not an empty portfolio. ${error.message.split('\n')[0] ?? ''}`}
      />
    );
  }

  if (isLoading) return <SkeletonRows rows={5} />;

  if (trades.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
      />
    );
  }

  return (
    <>
      {/* Desktop */}
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[880px] border-collapse text-left">
          <thead>
            <tr className="border-b border-line">
              {[
                'Trade',
                'Supplier',
                'Trade value',
                'Financed',
                'Collateral',
                'Status',
                'Next step',
                'Updated',
              ].map((heading) => (
                <th
                  key={heading}
                  scope="col"
                  className="px-4 py-2.5 text-[11px] font-semibold tracking-wide text-ink-subtle uppercase"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {trades.map(({chain, meta}) => {
              const step = nextStep(chain.state);
              return (
                <tr
                  key={chain.id.toString()}
                  className="border-b border-line last:border-0 hover:bg-surface-hover"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/trades/${chain.id}`}
                      className="block text-[13.5px] font-medium text-ink hover:text-accent"
                    >
                      {meta?.title ?? `Trade #${chain.id}`}
                    </Link>
                    <span className="numeric text-[12px] text-ink-subtle">#{chain.id.toString()}</span>
                  </td>
                  <td className="px-4 py-3 text-[13px] text-ink-muted">
                    <span className="block">{meta?.supplierName ?? 'Unnamed'}</span>
                    <span className="numeric font-mono text-[12px] text-ink-subtle">
                      {shortenAddress(chain.supplier)}
                    </span>
                  </td>
                  <td className="numeric px-4 py-3 text-[13.5px] font-medium text-ink">
                    {formatMoney(chain.terms.tradeValue)}
                  </td>
                  <td className="numeric px-4 py-3 text-[13.5px] text-ink-muted">
                    {formatMoney(chain.terms.financing)}
                  </td>
                  <td className="numeric px-4 py-3 text-[13.5px] text-ink-muted">
                    {formatMoney(chain.terms.collateral)}
                  </td>
                  <td className="px-4 py-3">
                    <TradeStatus state={chain.state} />
                    <TradeStepper state={chain.state} showLabels={false} className="mt-2 max-w-[132px]" />
                  </td>
                  <td className="px-4 py-3">
                    <span className="block text-[13px] text-ink">{step.label}</span>
                    <span className="text-[12px] text-ink-subtle">{step.actor}</span>
                  </td>
                  <td className="px-4 py-3 text-[13px] whitespace-nowrap text-ink-muted">
                    {formatDate(chain.createdAt)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <ul className="divide-y divide-line lg:hidden">
        {trades.map(({chain, meta}) => {
          const step = nextStep(chain.state);
          return (
            <li key={chain.id.toString()}>
              <Link href={`/trades/${chain.id}`} className="block px-4 py-4 hover:bg-surface-hover">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">
                      {meta?.title ?? `Trade #${chain.id}`}
                    </p>
                    <p className="mt-0.5 truncate text-[12px] text-ink-subtle">
                      {meta?.supplierName ?? shortenAddress(chain.supplier)}
                    </p>
                  </div>
                  <ArrowRight className="mt-1 size-4 shrink-0 text-ink-subtle" aria-hidden />
                </div>

                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="numeric text-[17px] font-semibold text-ink">
                    {formatMoney(chain.terms.tradeValue)}
                  </span>
                  <TradeStatus state={chain.state} />
                </div>

                <TradeStepper state={chain.state} className="mt-4" />

                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12px]">
                  <div className="flex justify-between">
                    <dt className="text-ink-subtle">Financed</dt>
                    <dd className="numeric text-ink-muted">{formatMoney(chain.terms.financing)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-ink-subtle">Collateral</dt>
                    <dd className="numeric text-ink-muted">
                      {formatMoney(chain.terms.collateral)}
                    </dd>
                  </div>
                </dl>

                <p className="mt-2.5 text-[12px] text-ink-muted">
                  Next: {step.label}
                  <span className="text-ink-subtle"> · {step.actor}</span>
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
