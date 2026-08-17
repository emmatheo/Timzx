'use client';

import {useMemo, useState} from 'react';
import {Search, Store} from 'lucide-react';

import {ButtonLink} from '@/components/ui/button';
import {Card, CardBody} from '@/components/ui/card';
import {DataOriginBadge} from '@/components/ui/data-mode';
import {Field, Select, TextInput} from '@/components/ui/field';
import {EmptyState, SkeletonRows} from '@/components/ui/states';
import {TradeStatus} from '@/components/trade/trade-status';
import {useAllTrades} from '@/hooks/use-protocol';
import {useTradeViews} from '@/hooks/use-trade-views';
import {collateralRatio, loanToValue} from '@/lib/finance';
import {formatMoney, formatPercent} from '@/lib/format';
import {SEED_LISTINGS} from '@/lib/services/trade-metadata';
import {TradeState} from '@/types/trade';

/**
 * Marketplace.
 *
 * Uses the light surface: this page is a long scan of numeric rows, and dark backgrounds cost
 * legibility when the eye is comparing figures across many cards.
 *
 * Live trades and illustrative listings are kept in separate, separately labelled sections. Mixing
 * them into one grid would be the exact failure mode the brief rules out — a reader must never
 * have to check a badge to work out whether a row is real.
 */
export default function MarketplacePage() {
  const {trades: entries, isLoading} = useAllTrades();
  const views = useTradeViews(entries);

  const [query, setQuery] = useState('');
  const [industry, setIndustry] = useState('all');
  const [status, setStatus] = useState('open');

  const industries = useMemo(() => {
    const set = new Set<string>(SEED_LISTINGS.map((listing) => listing.industry));
    for (const view of views) if (view.meta?.industry) set.add(view.meta.industry);
    return ['all', ...Array.from(set).sort()];
  }, [views]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return views.filter(({chain, meta}) => {
      if (status === 'open' && chain.state !== TradeState.COLLATERAL_LOCKED) return false;
      if (industry !== 'all' && meta?.industry !== industry) return false;
      if (!needle) return true;
      return [
        meta?.title,
        meta?.commodity,
        meta?.supplierName,
        meta?.originCountry,
        meta?.destinationCountry,
        `#${chain.id}`,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [views, query, industry, status]);

  const filteredSeeds = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return SEED_LISTINGS.filter((listing) => {
      if (industry !== 'all' && listing.industry !== industry) return false;
      if (!needle) return true;
      return [
        listing.title,
        listing.commodity,
        listing.supplierName,
        listing.originCountry,
        listing.destinationCountry,
      ].some((value) => value.toLowerCase().includes(needle));
    });
  }, [query, industry]);

  return (
    <div className="surface-light -mx-4 -mt-5 min-h-dvh px-4 pt-5 pb-6 sm:-mx-6 sm:px-6">
      <div className="space-y-5">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Trade Marketplace</h1>
          <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-ink-muted">
            Financing requests published by importers. Every figure on a live listing is read from
            the trade contract on Creditcoin.
          </p>
        </header>

        <Card>
          <CardBody className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Search" className="sm:col-span-2 lg:col-span-2">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-subtle"
                  aria-hidden
                />
                <TextInput
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Commodity, supplier, corridor or trade id"
                  className="pl-9"
                />
              </div>
            </Field>
            <Field label="Industry">
              <Select value={industry} onChange={(event) => setIndustry(event.target.value)}>
                {industries.map((value) => (
                  <option key={value} value={value}>
                    {value === 'all' ? 'All industries' : value}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Status">
              <Select value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="open">Open for financing</option>
                <option value="any">Any status</option>
              </Select>
            </Field>
          </CardBody>
        </Card>

        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-[15px] font-semibold tracking-tight text-ink">
              Live listings
              <span className="ml-2 text-[13px] font-normal text-ink-subtle">
                {filtered.length}
              </span>
            </h2>
            <DataOriginBadge origin="chain" />
          </div>

          {isLoading ? (
            <Card>
              <SkeletonRows rows={3} />
            </Card>
          ) : filtered.length === 0 ? (
            <Card>
              <EmptyState
                icon={Store}
                title="No live listings match"
                description="No on-chain trade is currently open for financing under these filters. The illustrative corridors below show the shape of a listing."
              />
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map(({chain, meta}) => (
                <Card key={chain.id.toString()} className="flex flex-col">
                  <CardBody className="flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-[15px] font-semibold text-ink">
                          {meta?.title ?? `Trade #${chain.id}`}
                        </h3>
                        <p className="mt-0.5 truncate text-[13px] text-ink-muted">
                          {meta?.supplierName ?? 'Unnamed supplier'}
                        </p>
                      </div>
                      <TradeStatus state={chain.state} />
                    </div>

                    {meta ? (
                      <p className="mt-2 text-[12px] text-ink-subtle">
                        {meta.originCountry} to {meta.destinationCountry}
                      </p>
                    ) : null}

                    <dl className="mt-4 space-y-2 text-[13px]">
                      <Row label="Trade value" value={formatMoney(chain.terms.tradeValue)} strong />
                      <Row label="Financing needed" value={formatMoney(chain.terms.financing)} />
                      <Row label="Collateral" value={formatMoney(chain.terms.collateral)} />
                      <Row
                        label="Collateral ratio"
                        value={formatPercent(collateralRatio(chain.terms))}
                      />
                      <Row label="LTV" value={formatPercent(loanToValue(chain.terms))} />
                      <Row label="Term" value={`${chain.terms.termDays} days`} />
                    </dl>
                  </CardBody>
                  <div className="border-t border-line px-5 py-3">
                    <ButtonLink href={`/trades/${chain.id}`} size="sm" variant="secondary">
                      View trade
                    </ButtonLink>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-[15px] font-semibold tracking-tight text-ink">
              Illustrative corridors
            </h2>
            <DataOriginBadge origin="seed" />
          </div>
          <p className="mb-3 max-w-3xl text-[13px] leading-relaxed text-ink-muted">
            These are not trades. They describe the corridors TImx is built for and exist so the
            marketplace is legible before real listings are posted. None of them has an on-chain
            record, and none can be financed.
          </p>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredSeeds.map((listing) => (
              <Card key={listing.key} className="border-dashed">
                <CardBody>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-[15px] font-semibold text-ink">
                        {listing.title}
                      </h3>
                      <p className="mt-0.5 truncate text-[13px] text-ink-muted">
                        {listing.supplierName}
                      </p>
                    </div>
                    <DataOriginBadge origin="seed" />
                  </div>
                  <p className="mt-2 text-[12px] text-ink-subtle">
                    {listing.originCountry} to {listing.destinationCountry} · {listing.incoterms}
                  </p>
                  <p className="mt-2.5 text-[12.5px] leading-relaxed text-ink-muted">
                    {listing.summary}
                  </p>
                  <dl className="mt-4 space-y-2 text-[13px]">
                    <Row
                      label="Trade value"
                      value={`$${listing.tradeValueUsd.toLocaleString('en-US')}`}
                      strong
                    />
                    <Row
                      label="Financing needed"
                      value={`$${(listing.tradeValueUsd - listing.collateralUsd).toLocaleString('en-US')}`}
                    />
                    <Row
                      label="Collateral"
                      value={`$${listing.collateralUsd.toLocaleString('en-US')}`}
                    />
                    <Row label="Term" value={`${listing.termDays} days`} />
                  </dl>
                </CardBody>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function Row({label, value, strong}: {label: string; value: string; strong?: boolean}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-ink-subtle">{label}</dt>
      <dd className={strong ? 'numeric font-semibold text-ink' : 'numeric text-ink-muted'}>
        {value}
      </dd>
    </div>
  );
}
