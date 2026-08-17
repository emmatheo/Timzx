'use client';

import {use, useMemo, useState} from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Ban,
  CircleDollarSign,
  PackageCheck,
  Send,
  ShieldCheck,
  Ship,
  Wallet,
} from 'lucide-react';

import {AttestationCard} from '@/components/attestation/attestation-card';
import {Badge} from '@/components/ui/badge';
import {Button} from '@/components/ui/button';
import {Card, CardBody, CardHeader} from '@/components/ui/card';
import {Copyable} from '@/components/ui/copyable';
import {DataPoint, Field, TextInput} from '@/components/ui/field';
import {Modal} from '@/components/ui/modal';
import {LoadingState} from '@/components/ui/states';
import {TradeStatus} from '@/components/trade/trade-status';
import {TradeTimeline, type TimelineEvidence} from '@/components/trade/trade-timeline';
import {useAttestation} from '@/hooks/use-attestation';
import {useAttestationLog} from '@/hooks/use-attestation-log';
import {useAttestationPolicy, useTrade} from '@/hooks/use-protocol';
import {useTradeActions} from '@/hooks/use-trade-actions';
import {useTradeViews} from '@/hooks/use-trade-views';
import {creditcoin, explorerAddressUrl} from '@/lib/config/chains';
import {
  collateralRatio,
  daysUntil,
  impliedApr,
  loanToValue,
  nextStep,
  totalRepayable,
} from '@/lib/finance';
import {formatDate, formatMoney, formatPercent, parseMoneyInput, shortenAddress} from '@/lib/format';
import {proofKindPresentation} from '@/lib/trade-state';
import {EventKind, TradeState, type TradeStateValue} from '@/types/trade';

export default function TradeDetailPage({params}: {params: Promise<{id: string}>}) {
  const {id} = use(params);
  const tradeId = useMemo(() => {
    try {
      return BigInt(id);
    } catch {
      return null;
    }
  }, [id]);

  const {trade, outstanding, isLoading, refetch} = useTrade(tradeId);
  const views = useTradeViews(trade ? [{trade, outstanding}] : []);
  const view = views[0] ?? null;
  const {entries: attestations, refetch: refetchLog} = useAttestationLog({
    tradeId: tradeId ?? undefined,
  });
  const policy = useAttestationPolicy();

  const refreshAll = async () => {
    await refetch();
    await refetchLog();
  };

  const actions = useTradeActions(refreshAll);
  const attestation = useAttestation();
  const [repayOpen, setRepayOpen] = useState(false);

  if (isLoading) return <LoadingState label="Loading trade" />;

  if (!trade || !view) {
    return (
      <Card>
        <CardBody className="py-14 text-center">
          <p className="text-sm font-medium text-ink">Trade not found</p>
          <p className="mt-1.5 text-[13px] text-ink-muted">
            No trade with id {id} exists on this deployment.
          </p>
          <Link href="/trades" className="mt-4 inline-block text-[13px] text-accent hover:underline">
            Back to my trades
          </Link>
        </CardBody>
      </Card>
    );
  }

  const {meta} = view;
  const step = nextStep(trade.state);
  const repayable = totalRepayable(trade.terms.financing, trade.terms.interestBps);

  // Map recorded attestations onto the lifecycle steps they authorised, so the timeline shows the
  // evidence next to the step rather than in a separate list the reader has to correlate manually.
  const evidence: Partial<Record<TradeStateValue, TimelineEvidence>> = {};
  for (const entry of attestations) {
    const target =
      entry.attestation.kind === EventKind.SHIPMENT_CONFIRMED
        ? TradeState.SHIPPED
        : entry.attestation.kind === EventKind.DELIVERY_CONFIRMED
          ? TradeState.DELIVERED
          : entry.attestation.kind === EventKind.SUPPLIER_VERIFIED
            ? TradeState.SUPPLIER_VERIFIED
            : null;
    if (target !== null) {
      evidence[target] = {
        attestation: entry.attestation,
        creditcoinTxHash: entry.creditcoinTxHash,
      };
    }
  }
  evidence[TradeState.APPLICATION] = {timestamp: trade.createdAt, actor: 'Buyer'};
  if (trade.fundedAt > 0) {
    evidence[TradeState.FUNDED] = {timestamp: trade.fundedAt, actor: 'Buyer'};
  }

  /** Submits an attestation, then applies it to the trade. Two steps, both real transactions. */
  const runAttestation = async (kind: typeof EventKind.SHIPMENT_CONFIRMED | typeof EventKind.DELIVERY_CONFIRMED) => {
    const result = await attestation.attest({
      tradeId: trade.id,
      kind,
      // A source transaction hash would normally come from the logistics event on Sepolia. Until a
      // source tx exists this is derived per trade and event so the record is unique and replay
      // protection still holds; it is not presented as a real source transaction.
      sourceTxHash: `0x${trade.id.toString(16).padStart(2, '0').repeat(32).slice(0, 64)}`,
      logIndex: kind,
    });
    if (result) {
      await actions.advanceWithAttestation(trade.id, result.attestationId);
    }
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

      <Card>
        <CardBody>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-semibold tracking-tight text-ink">
                  {meta?.title ?? `Trade #${trade.id}`}
                </h1>
                <TradeStatus state={trade.state} />
              </div>
              <p className="mt-1.5 text-[13.5px] text-ink-muted">
                Trade #{trade.id.toString()}
                {meta ? ` · ${meta.originCountry} to ${meta.destinationCountry}` : ''} ·{' '}
                {creditcoin.name}
              </p>
              <p className="mt-1 text-[13px] text-ink-subtle">
                Next: {step.label} <span className="text-ink-subtle">({step.actor})</span>
              </p>
            </div>
          </div>

          <dl className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-6">
            <DataPoint label="Trade value" value={formatMoney(trade.terms.tradeValue)} />
            <DataPoint
              label="Financed"
              value={formatMoney(trade.terms.financing)}
              hint={`${formatPercent(loanToValue(trade.terms))} LTV`}
            />
            <DataPoint
              label="Collateral"
              value={formatMoney(trade.terms.collateral)}
              hint={`${formatPercent(collateralRatio(trade.terms))} of value`}
            />
            <DataPoint
              label="Term"
              value={`${trade.terms.termDays} days`}
              hint={`${formatPercent(impliedApr(trade.terms.interestBps, trade.terms.termDays))} implied APR`}
            />
            <DataPoint
              label="Total repayable"
              value={formatMoney(repayable)}
              hint={`${(trade.terms.interestBps / 100).toFixed(2)}% fixed`}
            />
            <DataPoint
              label="Outstanding"
              value={formatMoney(outstanding)}
              hint={
                trade.maturityAt > 0
                  ? `Due ${formatDate(trade.maturityAt)} · ${daysUntil(trade.maturityAt)}d`
                  : 'Not yet funded'
              }
            />
          </dl>

          <dl className="mt-5 grid gap-4 border-t border-line pt-5 sm:grid-cols-3">
            <Party label="Buyer" name={meta?.buyerName} address={trade.buyer} />
            <Party label="Supplier" name={meta?.supplierName} address={trade.supplier} />
            <Party
              label="Financier"
              name={trade.financier === '0x0000000000000000000000000000000000000000' ? 'Not yet financed' : undefined}
              address={trade.financier}
            />
          </dl>
        </CardBody>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader
            title="Trade lifecycle"
            description="Each step records who acted, when, and on which chain the evidence originated."
          />
          <CardBody>
            <TradeTimeline trade={trade} evidence={evidence} />
          </CardBody>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader
              title="Attestcoin Verification"
              description="How cross-chain events reach this trade."
            />
            <CardBody className="space-y-3">
              <div className="rounded-lg border border-line bg-surface-overlay px-3 py-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[12px] tracking-wide text-ink-subtle uppercase">
                    Active adapter
                  </span>
                  <Badge tone={proofKindPresentation(policy.adapterProofKind as 0 | 1 | 2).tone}>
                    {proofKindPresentation(policy.adapterProofKind as 0 | 1 | 2).label}
                  </Badge>
                </div>
                <p className="mt-2 text-[12.5px] leading-relaxed text-ink-muted">
                  {proofKindPresentation(policy.adapterProofKind as 0 | 1 | 2).detail}
                </p>
                {policy.adapterAddress ? (
                  <div className="mt-2">
                    <Copyable
                      value={policy.adapterAddress}
                      display={shortenAddress(policy.adapterAddress)}
                      href={explorerAddressUrl(creditcoin.id, policy.adapterAddress)}
                    />
                  </div>
                ) : null}
                <p className="mt-2 text-[12px] text-ink-subtle">
                  Proof required on-chain:{' '}
                  {policy.requireProofBacked === null
                    ? 'unknown'
                    : policy.requireProofBacked
                      ? 'yes — demo assertions are rejected'
                      : 'no — demo assertions are accepted on this deployment'}
                </p>
              </div>

              {attestations.length === 0 ? (
                <p className="text-[13px] leading-relaxed text-ink-muted">
                  No cross-chain event has been recorded for this trade yet. Shipment and delivery
                  each require one.
                </p>
              ) : (
                attestations.map((entry) => (
                  <AttestationCard
                    key={entry.attestation.id}
                    attestation={entry.attestation}
                    creditcoinTxHash={entry.creditcoinTxHash}
                    destination="TradeFinance"
                  />
                ))
              )}

              {attestation.progress.stage !== 'idle' ? (
                <p className="rounded-lg border border-line bg-surface-overlay px-3 py-2 text-[12.5px] text-ink-muted">
                  {attestation.progress.message}
                </p>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Actions" description="Only steps valid from the current state." />
            <CardBody className="space-y-2">
              {trade.state === TradeState.APPLICATION ? (
                <Button
                  className="w-full"
                  icon={ShieldCheck}
                  loading={actions.state.pending}
                  onClick={() => actions.verifySupplier(trade.id)}
                >
                  Verify supplier
                </Button>
              ) : null}

              {trade.state === TradeState.SUPPLIER_VERIFIED ? (
                <Button
                  className="w-full"
                  icon={ShieldCheck}
                  loading={actions.state.pending}
                  onClick={() => actions.depositCollateral(trade.id, trade.terms.collateral)}
                >
                  Deposit {formatMoney(trade.terms.collateral)} collateral
                </Button>
              ) : null}

              {trade.state === TradeState.COLLATERAL_LOCKED ? (
                <Button
                  className="w-full"
                  icon={Wallet}
                  loading={actions.state.pending}
                  onClick={() => actions.commitFinancing(trade.id, trade.terms.financing)}
                >
                  Finance {formatMoney(trade.terms.financing)}
                </Button>
              ) : null}

              {trade.state === TradeState.FINANCING_APPROVED ? (
                <Button
                  className="w-full"
                  icon={Send}
                  loading={actions.state.pending}
                  onClick={() => actions.releaseFunds(trade.id)}
                >
                  Release funds to supplier
                </Button>
              ) : null}

              {trade.state === TradeState.FUNDED ? (
                <Button
                  className="w-full"
                  icon={Ship}
                  loading={actions.state.pending}
                  onClick={() => runAttestation(EventKind.SHIPMENT_CONFIRMED)}
                >
                  Submit shipment event
                </Button>
              ) : null}

              {trade.state === TradeState.SHIPPED ? (
                <Button
                  className="w-full"
                  icon={PackageCheck}
                  loading={actions.state.pending}
                  onClick={() => runAttestation(EventKind.DELIVERY_CONFIRMED)}
                >
                  Submit delivery event
                </Button>
              ) : null}

              {trade.state === TradeState.DELIVERED || trade.state === TradeState.REPAYING ? (
                <Button
                  className="w-full"
                  icon={CircleDollarSign}
                  onClick={() => setRepayOpen(true)}
                >
                  Repay {formatMoney(outstanding)}
                </Button>
              ) : null}

              {trade.state === TradeState.REPAID ? (
                <Button
                  className="w-full"
                  icon={ShieldCheck}
                  loading={actions.state.pending}
                  onClick={() => actions.complete(trade.id)}
                >
                  Close trade and release collateral
                </Button>
              ) : null}

              {trade.state <= TradeState.FINANCING_APPROVED ? (
                <Button
                  className="w-full"
                  variant="secondary"
                  icon={Ban}
                  loading={actions.state.pending}
                  onClick={() => actions.cancel(trade.id)}
                >
                  Cancel trade
                </Button>
              ) : null}

              {actions.state.error ? (
                <p className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-[12.5px] text-ink-muted">
                  {actions.state.error}
                </p>
              ) : null}

              <p className="pt-1 text-[12px] leading-relaxed text-ink-subtle">
                Actions the contracts would reject are hidden, but the contracts remain the
                authority: every button simulates before it signs.
              </p>
            </CardBody>
          </Card>
        </div>
      </div>

      <RepayModal
        open={repayOpen}
        outstanding={outstanding}
        pending={actions.state.pending}
        onClose={() => setRepayOpen(false)}
        onConfirm={async (amount) => {
          const ok = await actions.repay(trade.id, amount);
          if (ok) setRepayOpen(false);
        }}
      />
    </div>
  );
}

function Party({label, name, address}: {label: string; name?: string; address: string}) {
  const unset = address === '0x0000000000000000000000000000000000000000';
  return (
    <div>
      <dt className="text-[12px] font-medium tracking-wide text-ink-subtle uppercase">{label}</dt>
      <dd className="mt-1 text-[14px] font-medium text-ink">{name ?? 'Unnamed'}</dd>
      {!unset ? (
        <Copyable
          value={address}
          display={shortenAddress(address)}
          href={explorerAddressUrl(creditcoin.id, address)}
          className="mt-0.5"
        />
      ) : (
        <span className="text-[12px] text-ink-subtle">Not assigned</span>
      )}
    </div>
  );
}

function RepayModal({
  open,
  outstanding,
  pending,
  onClose,
  onConfirm,
}: {
  open: boolean;
  outstanding: bigint;
  pending: boolean;
  onClose: () => void;
  onConfirm: (amount: bigint) => void;
}) {
  const [raw, setRaw] = useState('');
  const parsed = parseMoneyInput(raw);
  const amount = raw.trim() === '' ? outstanding : parsed;
  const invalid = amount === null || amount <= 0n;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Make a repayment"
      description="Repayments flow directly to the financier. Partial repayments are allowed."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            loading={pending}
            disabled={invalid}
            onClick={() => amount !== null && onConfirm(amount)}
          >
            Repay {amount !== null ? formatMoney(amount) : '—'}
          </Button>
        </>
      }
    >
      <Field
        label="Amount"
        hint={`Outstanding balance ${formatMoney(outstanding, {precise: true})}. Leave blank to repay in full. Anything above the balance is reduced to it, so you can never overpay.`}
        error={raw.trim() !== '' && parsed === null ? 'Enter a valid dollar amount.' : null}
      >
        <TextInput
          value={raw}
          onChange={(event) => setRaw(event.target.value)}
          placeholder={formatMoney(outstanding, {precise: true})}
          inputMode="decimal"
        />
      </Field>
    </Modal>
  );
}
