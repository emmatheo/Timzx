'use client';

import {Activity, BadgeCheck, CircleDollarSign, ShieldCheck, TrendingUp} from 'lucide-react';
import {useAccount} from 'wagmi';

import {Badge} from '@/components/ui/badge';
import {Card, CardBody, CardHeader} from '@/components/ui/card';
import {DataPoint} from '@/components/ui/field';
import {EmptyState} from '@/components/ui/states';
import {StatCard} from '@/components/ui/stat-card';
import {useAttestationLog} from '@/hooks/use-attestation-log';
import {useCreditRecord, useMyTrades} from '@/hooks/use-protocol';
import {assessRisk} from '@/lib/finance';
import {formatMoney, formatMoneyCompact} from '@/lib/format';
import {ProofKind} from '@/types/trade';

/**
 * Credit profile.
 *
 * Two panels, deliberately not merged. "Verified onchain activity" is a count of what this
 * protocol observed and can prove. "TImx risk assessment" is our own heuristic over that activity.
 * Blending them into one number would produce something that looks like a credit score issued by
 * Creditcoin, which it would not be.
 */
export default function CreditProfilePage() {
  const {address, isConnected} = useAccount();
  const {record} = useCreditRecord();
  const {trades} = useMyTrades();
  const {entries} = useAttestationLog({limit: 100});

  if (!isConnected || !address) {
    return (
      <Card>
        <EmptyState
          icon={ShieldCheck}
          title="Connect a wallet"
          description="Your credit profile is derived from the trades this wallet has participated in."
        />
      </Card>
    );
  }

  const base = record ?? {
    tradesAsBuyer: 0,
    tradesCompleted: 0,
    tradesDefaulted: 0,
    tradesFinanced: 0,
    volumeTransacted: 0n,
    volumeFinanced: 0n,
    volumeRepaid: 0n,
    cumulativeRepaymentDays: 0,
  };

  const risk = assessRisk(base);
  const settled = base.tradesCompleted + base.tradesDefaulted;
  const avgDays =
    base.tradesCompleted > 0 ? Math.round(base.cumulativeRepaymentDays / base.tradesCompleted) : 0;

  const myAttestations = entries.filter((entry) =>
    trades.some(({trade}) => trade.id === entry.attestation.tradeId),
  );
  const proved = myAttestations.filter(
    (entry) => entry.attestation.proofKind === ProofKind.USC_PROOF,
  ).length;

  const riskTone =
    risk.band === 'low'
      ? 'positive'
      : risk.band === 'moderate'
        ? 'info'
        : risk.band === 'elevated'
          ? 'warning'
          : 'neutral';

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Credit Profile</h1>
        <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-ink-muted">
          Trading history for this wallet, as recorded by the TImx protocol on Creditcoin.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Trades originated"
          value={base.tradesAsBuyer.toString()}
          icon={Activity}
          source="On-chain"
        />
        <StatCard
          label="Completed"
          value={base.tradesCompleted.toString()}
          icon={BadgeCheck}
          source="On-chain"
        />
        <StatCard
          label="Total financed"
          value={formatMoneyCompact(base.volumeFinanced)}
          icon={TrendingUp}
          source="On-chain"
        />
        <StatCard
          label="Total repaid"
          value={formatMoneyCompact(base.volumeRepaid)}
          icon={CircleDollarSign}
          source="On-chain"
        />
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Verified onchain activity"
            description="Counted directly from protocol state. Nothing here is estimated or inferred."
            action={<Badge tone="info">Protocol data</Badge>}
          />
          <CardBody>
            <dl className="grid grid-cols-2 gap-5">
              <DataPoint label="Trades as buyer" value={base.tradesAsBuyer.toString()} />
              <DataPoint label="Trades financed" value={base.tradesFinanced.toString()} />
              <DataPoint label="Completed trades" value={base.tradesCompleted.toString()} />
              <DataPoint label="Defaults" value={base.tradesDefaulted.toString()} />
              <DataPoint
                label="Trade volume"
                value={formatMoney(base.volumeTransacted)}
              />
              <DataPoint label="Repaid volume" value={formatMoney(base.volumeRepaid)} />
              <DataPoint
                label="Average repayment time"
                value={base.tradesCompleted > 0 ? `${avgDays} days` : '—'}
                hint="From disbursement to full settlement"
              />
              <DataPoint
                label="Cross-chain events"
                value={`${proved} proved / ${myAttestations.length} total`}
                hint="Attestations attached to your trades"
              />
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="TImx risk assessment"
            description="Produced by this application from the activity on the left. Not issued or endorsed by Creditcoin."
            action={
              <Badge tone={riskTone}>
                {risk.band === 'insufficient-data' ? 'No history' : risk.band}
              </Badge>
            }
          />
          <CardBody>
            {risk.band === 'insufficient-data' ? (
              <p className="text-[13px] leading-relaxed text-ink-muted">
                This wallet has not settled a trade on this deployment, so there is nothing to
                assess. A risk band appears once at least one trade has completed or defaulted.
              </p>
            ) : (
              <>
                <div className="flex items-end gap-3">
                  <span className="numeric text-[38px] leading-none font-semibold text-ink">
                    {risk.score}
                  </span>
                  <span className="pb-1 text-[13px] text-ink-subtle">/ 100 heuristic score</span>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line">
                  <div
                    className={
                      risk.band === 'low'
                        ? 'h-full rounded-full bg-positive'
                        : risk.band === 'moderate'
                          ? 'h-full rounded-full bg-info'
                          : 'h-full rounded-full bg-warning'
                    }
                    style={{width: `${risk.score}%`}}
                  />
                </div>
                <ul className="mt-5 space-y-3">
                  {risk.factors.map((factor) => (
                    <li key={factor.label} className="flex gap-3">
                      <span
                        className={
                          factor.direction === 'positive'
                            ? 'mt-1.5 size-1.5 shrink-0 rounded-full bg-positive'
                            : factor.direction === 'negative'
                              ? 'mt-1.5 size-1.5 shrink-0 rounded-full bg-danger'
                              : 'mt-1.5 size-1.5 shrink-0 rounded-full bg-ink-subtle'
                        }
                        aria-hidden
                      />
                      <div>
                        <p className="text-[13px] font-medium text-ink">{factor.label}</p>
                        <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-muted">
                          {factor.detail}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <p className="mt-5 border-t border-line pt-4 text-[12px] leading-relaxed text-ink-subtle">
              {settled} settled trade{settled === 1 ? '' : 's'} informed this assessment. It is
              application logic over public protocol state, not a credit rating, and it carries no
              regulatory standing.
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
