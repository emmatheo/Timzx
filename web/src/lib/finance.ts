/**
 * Trade-finance arithmetic.
 *
 * Every figure the UI shows is derived here from bigint token units, so the numbers on screen are
 * the numbers the contracts will compute. Nothing is rounded until it is formatted for display.
 */
import {TradeState, type OnChainTrade, type TradeStateValue, type TradeTerms} from '@/types/trade';

export const BPS = 10_000n;
export const SETTLEMENT_DECIMALS = 6;

/** Interest charged over the whole term. Mirrors `RepaymentManager.open`. */
export function interestAmount(financing: bigint, interestBps: number): bigint {
  return (financing * BigInt(interestBps)) / BPS;
}

/** Principal plus interest — what the buyer repays in total. */
export function totalRepayable(financing: bigint, interestBps: number): bigint {
  return financing + interestAmount(financing, interestBps);
}

/**
 * Collateral as a percentage of trade value. This is the buyer's skin in the game.
 * Returned as a number because it is only ever displayed, never used for settlement.
 */
export function collateralRatio(terms: Pick<TradeTerms, 'collateral' | 'tradeValue'>): number {
  if (terms.tradeValue === 0n) return 0;
  return Number((terms.collateral * 10_000n) / terms.tradeValue) / 100;
}

/** Financed portion as a percentage of trade value. */
export function financingRatio(terms: Pick<TradeTerms, 'financing' | 'tradeValue'>): number {
  if (terms.tradeValue === 0n) return 0;
  return Number((terms.financing * 10_000n) / terms.tradeValue) / 100;
}

/**
 * Loan to value: financing measured against the collateral backing it.
 * Above 100% by construction — collateral only ever partially covers the exposure, which is the
 * whole reason a financier is taking risk rather than holding a fully secured note.
 */
export function loanToValue(terms: Pick<TradeTerms, 'financing' | 'collateral'>): number {
  if (terms.collateral === 0n) return 0;
  return Number((terms.financing * 10_000n) / terms.collateral) / 100;
}

/** Annualised rate implied by a fixed charge over `termDays`, for comparison across terms. */
export function impliedApr(interestBps: number, termDays: number): number {
  if (termDays === 0) return 0;
  return (interestBps / 100) * (365 / termDays);
}

export function maturityDate(trade: Pick<OnChainTrade, 'maturityAt'>): Date | null {
  return trade.maturityAt > 0 ? new Date(trade.maturityAt * 1000) : null;
}

export function daysUntil(timestampSeconds: number, now = Date.now()): number {
  if (timestampSeconds === 0) return 0;
  return Math.ceil((timestampSeconds * 1000 - now) / 86_400_000);
}

/** True once the repayment window has closed with a balance still outstanding. */
export function isOverdue(trade: OnChainTrade, outstanding: bigint, now = Date.now()): boolean {
  if (trade.maturityAt === 0 || outstanding === 0n) return false;
  return now > trade.maturityAt * 1000;
}

/**
 * The action the trade is waiting on, and who owes it.
 *
 * Trade finance stalls when nobody knows whose turn it is, so this is computed once and shown in
 * the table, on the card and at the top of the detail page rather than being re-derived ad hoc.
 */
export interface NextStep {
  label: string;
  actor: 'Buyer' | 'Supplier' | 'Financier' | 'Verifier' | 'Logistics' | 'None';
}

export function nextStep(state: TradeStateValue): NextStep {
  switch (state) {
    case TradeState.APPLICATION:
      return {label: 'Awaiting supplier verification', actor: 'Verifier'};
    case TradeState.SUPPLIER_VERIFIED:
      return {label: 'Deposit collateral', actor: 'Buyer'};
    case TradeState.COLLATERAL_LOCKED:
      return {label: 'Awaiting financing', actor: 'Financier'};
    case TradeState.FINANCING_APPROVED:
      return {label: 'Release funds to supplier', actor: 'Buyer'};
    case TradeState.FUNDED:
      return {label: 'Awaiting shipment confirmation', actor: 'Logistics'};
    case TradeState.SHIPPED:
      return {label: 'Awaiting delivery confirmation', actor: 'Logistics'};
    case TradeState.DELIVERED:
      return {label: 'Begin repayment', actor: 'Buyer'};
    case TradeState.REPAYING:
      return {label: 'Complete repayment', actor: 'Buyer'};
    case TradeState.REPAID:
      return {label: 'Close trade and release collateral', actor: 'Buyer'};
    default:
      return {label: 'No action required', actor: 'None'};
  }
}

/**
 * Risk assessment produced by TImx, not by Creditcoin.
 *
 * This is application logic over observed on-chain activity — a heuristic, presented as one. It is
 * deliberately kept separate from the verified-activity counters so the UI can show what is
 * *proven* apart from what TImx *infers*, and never blur the two into a single authoritative-
 * looking score.
 */
export type RiskBand = 'low' | 'moderate' | 'elevated' | 'insufficient-data';

export interface RiskAssessment {
  band: RiskBand;
  /** 0-100. Meaningless without `band`; never render it alone. */
  score: number;
  factors: {label: string; detail: string; direction: 'positive' | 'negative' | 'neutral'}[];
}

export function assessRisk(record: {
  tradesAsBuyer: number;
  tradesCompleted: number;
  tradesDefaulted: number;
  cumulativeRepaymentDays: number;
}): RiskAssessment {
  const settled = record.tradesCompleted + record.tradesDefaulted;
  const factors: RiskAssessment['factors'] = [];

  if (settled === 0) {
    return {
      band: 'insufficient-data',
      score: 0,
      factors: [
        {
          label: 'No settled trades',
          detail: 'This account has not yet completed or defaulted on a trade on this deployment.',
          direction: 'neutral',
        },
      ],
    };
  }

  const completionRate = record.tradesCompleted / settled;
  const avgDays =
    record.tradesCompleted > 0 ? record.cumulativeRepaymentDays / record.tradesCompleted : 0;

  let score = Math.round(completionRate * 70);

  factors.push({
    label: 'Completion rate',
    detail: `${record.tradesCompleted} of ${settled} settled trades repaid in full.`,
    direction: completionRate >= 0.9 ? 'positive' : completionRate >= 0.6 ? 'neutral' : 'negative',
  });

  if (record.tradesDefaulted > 0) {
    factors.push({
      label: 'Defaults on record',
      detail: `${record.tradesDefaulted} trade${record.tradesDefaulted === 1 ? '' : 's'} reached maturity unpaid.`,
      direction: 'negative',
    });
  }

  if (record.tradesCompleted > 0) {
    const promptness = avgDays <= 60 ? 20 : avgDays <= 90 ? 12 : 4;
    score += promptness;
    factors.push({
      label: 'Repayment speed',
      detail: `Average ${Math.round(avgDays)} days from funding to full repayment.`,
      direction: avgDays <= 60 ? 'positive' : avgDays <= 90 ? 'neutral' : 'negative',
    });
  }

  const depth = Math.min(record.tradesAsBuyer, 10);
  score += depth;
  factors.push({
    label: 'Trade history depth',
    detail: `${record.tradesAsBuyer} trade${record.tradesAsBuyer === 1 ? '' : 's'} originated.`,
    direction: record.tradesAsBuyer >= 5 ? 'positive' : 'neutral',
  });

  const band: RiskBand = score >= 80 ? 'low' : score >= 55 ? 'moderate' : 'elevated';
  return {band, score: Math.min(100, score), factors};
}
