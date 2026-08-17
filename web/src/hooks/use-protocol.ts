'use client';

import {useMemo} from 'react';
import {useAccount, useReadContract, useReadContracts} from 'wagmi';
import type {Address} from 'viem';

import {
  collateralVaultAbi,
  demoAttestationAdapterAbi,
  repaymentManagerAbi,
  testUSDAbi,
  tradeFinanceAbi,
} from '@/lib/abi';
import {contractAddresses} from '@/lib/config/env';
import {creditcoin} from '@/lib/config/chains';
import {
  ProofKind,
  TradeState,
  type CreditRecord,
  type OnChainTrade,
  type TradeStateValue,
} from '@/types/trade';

const financeAddress = contractAddresses.tradeFinance;

/** Base config shared by every TradeFinance read, so the chain is never accidentally omitted. */
const financeContract = financeAddress
  ? ({address: financeAddress, abi: tradeFinanceAbi, chainId: creditcoin.id} as const)
  : null;

/** Total number of trades ever created on this deployment. */
export function useTradeCount() {
  return useReadContract({
    ...(financeContract ?? {}),
    address: financeAddress ?? undefined,
    abi: tradeFinanceAbi,
    chainId: creditcoin.id,
    functionName: 'tradeCount',
    query: {enabled: financeAddress !== null},
  });
}

/** Shapes a raw contract tuple into the domain type. */
function toTrade(raw: {
  id: bigint;
  buyer: Address;
  supplier: Address;
  financier: Address;
  terms: {
    tradeValue: bigint;
    collateral: bigint;
    financing: bigint;
    interestBps: number;
    termDays: number;
  };
  state: number;
  createdAt: bigint;
  fundedAt: bigint;
  maturityAt: bigint;
  metadataHash: `0x${string}`;
}): OnChainTrade {
  return {
    id: raw.id,
    buyer: raw.buyer,
    supplier: raw.supplier,
    financier: raw.financier,
    terms: {
      tradeValue: raw.terms.tradeValue,
      collateral: raw.terms.collateral,
      financing: raw.terms.financing,
      interestBps: Number(raw.terms.interestBps),
      termDays: Number(raw.terms.termDays),
    },
    state: raw.state as TradeStateValue,
    createdAt: Number(raw.createdAt),
    fundedAt: Number(raw.fundedAt),
    maturityAt: Number(raw.maturityAt),
    metadataHash: raw.metadataHash,
  };
}

/**
 * Every trade on the deployment, with its outstanding balance.
 *
 * Reads are batched through multicall: one round trip regardless of how many trades exist, which
 * matters because the marketplace and dashboard both want the full set.
 */
export function useAllTrades() {
  const {data: count, isLoading: countLoading, refetch: refetchCount} = useTradeCount();
  const total = count ? Number(count) : 0;

  const contracts = useMemo(() => {
    if (!financeAddress || total === 0) return [];
    return Array.from({length: total}, (_, index) => index + 1).flatMap((id) => [
      {
        address: financeAddress,
        abi: tradeFinanceAbi,
        chainId: creditcoin.id,
        functionName: 'getTrade',
        args: [BigInt(id)],
      } as const,
      {
        address: financeAddress,
        abi: tradeFinanceAbi,
        chainId: creditcoin.id,
        functionName: 'outstandingOf',
        args: [BigInt(id)],
      } as const,
    ]);
  }, [total]);

  const {data, isLoading, refetch} = useReadContracts({
    contracts,
    query: {enabled: contracts.length > 0},
  });

  const trades = useMemo(() => {
    if (!data) return [];
    const result: {trade: OnChainTrade; outstanding: bigint}[] = [];
    for (let index = 0; index < data.length; index += 2) {
      const tradeResult = data[index];
      const outstandingResult = data[index + 1];
      if (tradeResult?.status !== 'success' || outstandingResult?.status !== 'success') continue;
      const trade = toTrade(tradeResult.result as Parameters<typeof toTrade>[0]);
      if (trade.id === 0n) continue;
      result.push({trade, outstanding: outstandingResult.result as bigint});
    }
    return result;
  }, [data]);

  return {
    trades,
    isLoading: countLoading || isLoading,
    refetch: async () => {
      await refetchCount();
      await refetch();
    },
  };
}

/** A single trade plus its outstanding balance. */
export function useTrade(tradeId: bigint | null) {
  const enabled = financeAddress !== null && tradeId !== null && tradeId > 0n;

  const {data, isLoading, refetch} = useReadContracts({
    contracts: enabled
      ? [
          {
            address: financeAddress,
            abi: tradeFinanceAbi,
            chainId: creditcoin.id,
            functionName: 'getTrade',
            args: [tradeId],
          } as const,
          {
            address: financeAddress,
            abi: tradeFinanceAbi,
            chainId: creditcoin.id,
            functionName: 'outstandingOf',
            args: [tradeId],
          } as const,
        ]
      : [],
    query: {enabled},
  });

  const trade =
    data?.[0]?.status === 'success'
      ? toTrade(data[0].result as Parameters<typeof toTrade>[0])
      : null;

  return {
    trade: trade && trade.id !== 0n ? trade : null,
    outstanding: data?.[1]?.status === 'success' ? (data[1].result as bigint) : 0n,
    isLoading,
    refetch,
  };
}

/** Aggregate on-chain activity for an address. Activity, not a score. */
export function useCreditRecord(account?: Address) {
  const {address: connected} = useAccount();
  const target = account ?? connected;

  const {data, isLoading, refetch} = useReadContract({
    address: financeAddress ?? undefined,
    abi: tradeFinanceAbi,
    chainId: creditcoin.id,
    functionName: 'creditRecordOf',
    args: target ? [target] : undefined,
    query: {enabled: financeAddress !== null && target !== undefined},
  });

  const record: CreditRecord | null = data
    ? {
        tradesAsBuyer: Number(data.tradesAsBuyer),
        tradesCompleted: Number(data.tradesCompleted),
        tradesDefaulted: Number(data.tradesDefaulted),
        tradesFinanced: Number(data.tradesFinanced),
        volumeTransacted: data.volumeTransacted,
        volumeFinanced: data.volumeFinanced,
        volumeRepaid: data.volumeRepaid,
        cumulativeRepaymentDays: Number(data.cumulativeRepaymentDays),
      }
    : null;

  return {record, isLoading, refetch, address: target};
}

/**
 * The attestation policy this deployment enforces.
 *
 * Read from the chain rather than from configuration: the adapter's own `proofKind` and the
 * protocol's `requireProofBacked` flag are what actually govern whether an unproved event can move
 * a trade, so those are what the UI reports.
 */
export function useAttestationPolicy() {
  const {data} = useReadContracts({
    contracts: financeAddress
      ? [
          {
            address: financeAddress,
            abi: tradeFinanceAbi,
            chainId: creditcoin.id,
            functionName: 'requireProofBacked',
          } as const,
          {
            address: financeAddress,
            abi: tradeFinanceAbi,
            chainId: creditcoin.id,
            functionName: 'attestationAdapter',
          } as const,
        ]
      : [],
    query: {enabled: financeAddress !== null},
  });

  const adapterAddress =
    data?.[1]?.status === 'success' ? (data[1].result as Address) : undefined;

  const {data: adapterKind} = useReadContract({
    address: adapterAddress,
    abi: demoAttestationAdapterAbi,
    chainId: creditcoin.id,
    functionName: 'proofKind',
    query: {enabled: adapterAddress !== undefined},
  });

  return {
    requireProofBacked: data?.[0]?.status === 'success' ? (data[0].result as boolean) : null,
    adapterAddress: adapterAddress ?? null,
    adapterProofKind: adapterKind !== undefined ? Number(adapterKind) : ProofKind.NONE,
  };
}

/** Settlement token balance and metadata for an address. */
export function useSettlementToken(account?: Address) {
  const {address: connected} = useAccount();
  const target = account ?? connected;
  const token = contractAddresses.settlementToken;

  const {data, isLoading, refetch} = useReadContracts({
    contracts:
      token && target
        ? [
            {
              address: token,
              abi: testUSDAbi,
              chainId: creditcoin.id,
              functionName: 'balanceOf',
              args: [target],
            } as const,
            {
              address: token,
              abi: testUSDAbi,
              chainId: creditcoin.id,
              functionName: 'symbol',
            } as const,
            {
              address: token,
              abi: testUSDAbi,
              chainId: creditcoin.id,
              functionName: 'decimals',
            } as const,
          ]
        : [],
    query: {enabled: token !== null && target !== undefined},
  });

  return {
    balance: data?.[0]?.status === 'success' ? (data[0].result as bigint) : 0n,
    symbol: data?.[1]?.status === 'success' ? (data[1].result as string) : 'tUSD',
    decimals: data?.[2]?.status === 'success' ? Number(data[2].result) : 6,
    isLoading,
    refetch,
  };
}

/** Collateral currently held for a trade. */
export function useLockedCollateral(tradeId: bigint | null) {
  return useReadContract({
    address: contractAddresses.collateralVault ?? undefined,
    abi: collateralVaultAbi,
    chainId: creditcoin.id,
    functionName: 'lockedOf',
    args: tradeId !== null ? [tradeId] : undefined,
    query: {enabled: contractAddresses.collateralVault !== null && tradeId !== null},
  });
}

/** Full repayment obligation for a trade. */
export function useObligation(tradeId: bigint | null) {
  return useReadContract({
    address: contractAddresses.repaymentManager ?? undefined,
    abi: repaymentManagerAbi,
    chainId: creditcoin.id,
    functionName: 'obligationOf',
    args: tradeId !== null ? [tradeId] : undefined,
    query: {enabled: contractAddresses.repaymentManager !== null && tradeId !== null},
  });
}

/** Trades where the connected wallet is a counterparty, in either direction. */
export function useMyTrades() {
  const {address} = useAccount();
  const {trades, isLoading, refetch} = useAllTrades();

  const mine = useMemo(() => {
    if (!address) return [];
    const lower = address.toLowerCase();
    return trades.filter(
      ({trade}) =>
        trade.buyer.toLowerCase() === lower ||
        trade.supplier.toLowerCase() === lower ||
        trade.financier.toLowerCase() === lower,
    );
  }, [trades, address]);

  return {trades: mine, isLoading, refetch};
}

/** Trades open for financing: collateral locked, no financier yet. */
export function useFinanceableTrades() {
  const {trades, isLoading, refetch} = useAllTrades();
  const open = useMemo(
    () => trades.filter(({trade}) => trade.state === TradeState.COLLATERAL_LOCKED),
    [trades],
  );
  return {trades: open, isLoading, refetch};
}
