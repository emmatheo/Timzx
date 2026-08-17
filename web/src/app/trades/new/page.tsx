'use client';

import {useMemo, useState} from 'react';
import {useRouter} from 'next/navigation';
import {ArrowLeft, Plus} from 'lucide-react';
import Link from 'next/link';
import {isAddress, keccak256, toHex, type Address} from 'viem';

import {Button} from '@/components/ui/button';
import {Card, CardBody, CardHeader} from '@/components/ui/card';
import {DataPoint, Field, Select, TextInput} from '@/components/ui/field';
import {useTradeActions} from '@/hooks/use-trade-actions';
import {useTradeCount} from '@/hooks/use-protocol';
import {creditcoin} from '@/lib/config/chains';
import {
  collateralRatio,
  impliedApr,
  loanToValue,
  totalRepayable,
} from '@/lib/finance';
import {formatMoney, formatPercent, parseMoneyInput} from '@/lib/format';
import {SEED_LISTINGS, saveTradeMetadata} from '@/lib/services/trade-metadata';

/**
 * Trade origination.
 *
 * The form computes the same figures the contracts will, from the same bigint inputs, so the
 * summary panel is a preview of the on-chain outcome rather than an independent estimate. The
 * prefill dropdown pulls from the illustrative corridors — it fills the fields in and then gets
 * out of the way; what gets created is a real trade with the user's own numbers.
 */
export default function NewTradePage() {
  const router = useRouter();
  const {data: countBefore, refetch: refetchCount} = useTradeCount();
  const actions = useTradeActions();

  const [supplier, setSupplier] = useState('');
  const [tradeValueRaw, setTradeValueRaw] = useState('');
  const [collateralRaw, setCollateralRaw] = useState('');
  const [termDays, setTermDays] = useState('90');
  const [interestPercent, setInterestPercent] = useState('8');

  const [title, setTitle] = useState('');
  const [commodity, setCommodity] = useState('');
  const [industry, setIndustry] = useState('');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [supplierName, setSupplierName] = useState('');

  const tradeValue = parseMoneyInput(tradeValueRaw);
  const collateral = parseMoneyInput(collateralRaw);
  const term = Number(termDays);
  const interestBps = Math.round(Number(interestPercent) * 100);

  const errors = useMemo(() => {
    const found: Record<string, string> = {};
    if (supplier && !isAddress(supplier)) found.supplier = 'Not a valid EVM address.';
    if (tradeValueRaw && tradeValue === null) found.tradeValue = 'Enter a valid amount.';
    if (collateralRaw && collateral === null) found.collateral = 'Enter a valid amount.';
    if (tradeValue !== null && collateral !== null) {
      if (collateral <= 0n) found.collateral = 'Collateral must be greater than zero.';
      else if (collateral >= tradeValue)
        found.collateral = 'Collateral must be below the trade value — a fully covered trade needs no financing.';
    }
    if (!Number.isFinite(term) || term <= 0) found.term = 'Term must be at least one day.';
    if (!Number.isFinite(interestBps) || interestBps < 0) found.interest = 'Enter a valid rate.';
    return found;
  }, [supplier, tradeValueRaw, tradeValue, collateralRaw, collateral, term, interestBps]);

  const valid =
    isAddress(supplier) &&
    tradeValue !== null &&
    collateral !== null &&
    collateral > 0n &&
    collateral < tradeValue &&
    term > 0 &&
    Object.keys(errors).length === 0;

  const financing = tradeValue !== null && collateral !== null ? tradeValue - collateral : 0n;
  const terms = {tradeValue: tradeValue ?? 0n, collateral: collateral ?? 0n, financing};

  const prefill = (key: string) => {
    const listing = SEED_LISTINGS.find((entry) => entry.key === key);
    if (!listing) return;
    setTitle(listing.title);
    setCommodity(listing.commodity);
    setIndustry(listing.industry);
    setOrigin(listing.originCountry);
    setDestination(listing.destinationCountry);
    setSupplierName(listing.supplierName);
    setTradeValueRaw(String(listing.tradeValueUsd));
    setCollateralRaw(String(listing.collateralUsd));
    setTermDays(String(listing.termDays));
    setInterestPercent((listing.interestBps / 100).toFixed(2));
  };

  const submit = async () => {
    if (!valid || tradeValue === null || collateral === null) return;

    // Anchors the descriptive record to the trade: the same fields hashed here can be rehashed
    // later to check the stored metadata has not been altered.
    const metadataHash = keccak256(
      toHex(
        JSON.stringify({title, commodity, industry, origin, destination, supplierName}),
      ),
    );

    const ok = await actions.createTrade({
      supplier: supplier as Address,
      tradeValue,
      collateral,
      interestBps,
      termDays: term,
      metadataHash,
    });

    if (!ok) return;

    // The contract assigns the id, so read it back rather than guessing.
    const {data: countAfter} = await refetchCount();
    const newId = countAfter ?? (countBefore ?? 0n) + 1n;

    await saveTradeMetadata({
      tradeId: newId.toString(),
      chainId: creditcoin.id,
      title: title || `Trade #${newId}`,
      commodity,
      industry,
      originCountry: origin,
      destinationCountry: destination,
      supplierName,
      buyerName: '',
      incoterms: null,
      summary: null,
      isSeed: false,
    });

    router.push(`/trades/${newId}`);
  };

  return (
    <div className="space-y-5">
      <Link
        href="/trades"
        className="inline-flex items-center gap-1.5 text-[13px] text-ink-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Back to my trades
      </Link>

      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Create Trade</h1>
        <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-ink-muted">
          Commercial terms are fixed at creation and cannot be changed afterwards. The supplier is
          verified before you post collateral.
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-5">
          <Card>
            <CardHeader
              title="Commercial terms"
              description="Written to the trade contract. Immutable once created."
            />
            <CardBody className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Supplier address"
                className="sm:col-span-2"
                error={errors.supplier ?? null}
                hint="The EVM address that will receive the disbursement on Creditcoin."
              >
                <TextInput
                  value={supplier}
                  onChange={(event) => setSupplier(event.target.value)}
                  placeholder="0x…"
                  spellCheck={false}
                />
              </Field>

              <Field label="Trade value (USD)" error={errors.tradeValue ?? null}>
                <TextInput
                  value={tradeValueRaw}
                  onChange={(event) => setTradeValueRaw(event.target.value)}
                  placeholder="50000"
                  inputMode="decimal"
                />
              </Field>

              <Field
                label="Your collateral (USD)"
                error={errors.collateral ?? null}
                hint="Locked in the vault until the trade completes."
              >
                <TextInput
                  value={collateralRaw}
                  onChange={(event) => setCollateralRaw(event.target.value)}
                  placeholder="10000"
                  inputMode="decimal"
                />
              </Field>

              <Field label="Term (days)" error={errors.term ?? null}>
                <TextInput
                  value={termDays}
                  onChange={(event) => setTermDays(event.target.value)}
                  inputMode="numeric"
                />
              </Field>

              <Field
                label="Interest over term (%)"
                error={errors.interest ?? null}
                hint="Fixed simple interest on the financed amount, not per annum."
              >
                <TextInput
                  value={interestPercent}
                  onChange={(event) => setInterestPercent(event.target.value)}
                  inputMode="decimal"
                />
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Trade description"
              description="Stored off-chain and anchored by hash. Helps financiers assess the corridor."
              action={
                <Select
                  defaultValue=""
                  onChange={(event) => prefill(event.target.value)}
                  className="h-8 w-auto text-[13px]"
                >
                  <option value="">Prefill from corridor</option>
                  {SEED_LISTINGS.map((listing) => (
                    <option key={listing.key} value={listing.key}>
                      {listing.title}
                    </option>
                  ))}
                </Select>
              }
            />
            <CardBody className="grid gap-4 sm:grid-cols-2">
              <Field label="Title" className="sm:col-span-2">
                <TextInput
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Solar Panels Import"
                />
              </Field>
              <Field label="Commodity">
                <TextInput
                  value={commodity}
                  onChange={(event) => setCommodity(event.target.value)}
                  placeholder="Monocrystalline PV modules"
                />
              </Field>
              <Field label="Industry">
                <TextInput
                  value={industry}
                  onChange={(event) => setIndustry(event.target.value)}
                  placeholder="Renewable Energy"
                />
              </Field>
              <Field label="Origin country">
                <TextInput
                  value={origin}
                  onChange={(event) => setOrigin(event.target.value)}
                  placeholder="China"
                />
              </Field>
              <Field label="Destination country">
                <TextInput
                  value={destination}
                  onChange={(event) => setDestination(event.target.value)}
                  placeholder="Nigeria"
                />
              </Field>
              <Field label="Supplier name" className="sm:col-span-2">
                <TextInput
                  value={supplierName}
                  onChange={(event) => setSupplierName(event.target.value)}
                  placeholder="SolarTech Ltd."
                />
              </Field>
            </CardBody>
          </Card>
        </div>

        <Card className="h-fit lg:sticky lg:top-24">
          <CardHeader
            title="Summary"
            description="Computed exactly as the contracts will compute it."
          />
          <CardBody>
            <dl className="grid grid-cols-2 gap-5">
              <DataPoint
                label="Trade value"
                value={tradeValue !== null ? formatMoney(tradeValue) : '—'}
              />
              <DataPoint
                label="Financing required"
                value={financing > 0n ? formatMoney(financing) : '—'}
              />
              <DataPoint
                label="Collateral ratio"
                value={tradeValue ? formatPercent(collateralRatio(terms)) : '—'}
              />
              <DataPoint
                label="LTV"
                value={collateral ? formatPercent(loanToValue(terms)) : '—'}
              />
              <DataPoint
                label="Total repayable"
                value={financing > 0n ? formatMoney(totalRepayable(financing, interestBps)) : '—'}
              />
              <DataPoint
                label="Implied APR"
                value={term > 0 ? formatPercent(impliedApr(interestBps, term)) : '—'}
              />
              <DataPoint
                label="Maturity"
                value={
                  term > 0
                    ? new Date(Date.now() + term * 86_400_000).toLocaleDateString('en-US', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })
                    : '—'
                }
                hint="Counted from disbursement, not from creation"
              />
            </dl>

            <Button
              className="mt-6 w-full"
              icon={Plus}
              loading={actions.state.pending}
              disabled={!valid || !actions.ready}
              onClick={() => void submit()}
            >
              Create trade
            </Button>

            {!actions.ready ? (
              <p className="mt-2.5 text-[12px] leading-relaxed text-ink-subtle">
                Connect a wallet on {creditcoin.name} with the protocol deployed to create a trade.
              </p>
            ) : null}

            {actions.state.error ? (
              <p className="mt-2.5 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-[12.5px] text-ink-muted">
                {actions.state.error}
              </p>
            ) : null}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
