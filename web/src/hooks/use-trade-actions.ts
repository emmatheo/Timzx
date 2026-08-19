'use client';

import {useCallback, useState} from 'react';
import type {Address, Hex} from 'viem';

import {useToast} from '@/components/ui/toast';
import {creditcoin, explorerTxUrl} from '@/lib/config/chains';
import {readableError} from '@/lib/services';
import type {CreateTradeInput} from '@/lib/services';
import {useServices} from './use-services';

export interface ActionState {
  pending: boolean;
  /** Which step is in flight, so the UI can distinguish approving from depositing. */
  step: string | null;
  error: string | null;
}

const idle: ActionState = {pending: false, step: null, error: null};

/**
 * Write paths for the trade lifecycle.
 *
 * A thin shell over the service layer: it owns progress state and user-facing reporting, and
 * delegates every decision about how a transaction is built. The services simulate before signing,
 * so a transition the contracts would reject surfaces as a specific reason before the user pays
 * gas or signs anything.
 */
export function useTradeActions(onSettled?: () => void | Promise<void>) {
  const services = useServices();
  const {push} = useToast();
  const [state, setState] = useState<ActionState>(idle);

  const run = useCallback(
    async (step: string, successTitle: string, action: () => Promise<Hex>): Promise<boolean> => {
      if (!services?.ready) {
        push({kind: 'error', title: 'Connect a wallet first'});
        return false;
      }
      try {
        setState({pending: true, step, error: null});
        const hash = await action();
        push({
          kind: 'success',
          title: successTitle,
          href: explorerTxUrl(creditcoin.id, hash) ?? undefined,
        });
        setState(idle);
        await onSettled?.();
        return true;
      } catch (error) {
        const message = readableError(error);
        setState({pending: false, step: null, error: message});
        push({kind: 'error', title: `${step} failed`, description: message});
        return false;
      }
    },
    [onSettled, push, services],
  );

  const createTrade = useCallback(
    (input: CreateTradeInput) =>
      run('Create trade', 'Trade created', () => services!.trades.create(input)),
    [run, services],
  );

  const depositCollateral = useCallback(
    (tradeId: bigint, collateral: bigint) =>
      run('Deposit collateral', 'Collateral locked', async () => {
        const {deposit} = await services!.collateral.deposit(tradeId, collateral);
        return deposit;
      }),
    [run, services],
  );

  const commitFinancing = useCallback(
    (tradeId: bigint, financing: bigint) =>
      run('Commit financing', 'Financing committed to escrow', async () => {
        const {commit} = await services!.financing.commit(tradeId, financing);
        return commit;
      }),
    [run, services],
  );

  const releaseFunds = useCallback(
    (tradeId: bigint) =>
      run('Release funds', 'Funds released to supplier', () =>
        services!.trades.releaseFunds(tradeId),
      ),
    [run, services],
  );

  const repay = useCallback(
    (tradeId: bigint, amount: bigint) =>
      run('Repay', 'Repayment settled', async () => {
        const {repay: hash} = await services!.trades.repay(tradeId, amount);
        return hash;
      }),
    [run, services],
  );

  const complete = useCallback(
    (tradeId: bigint) =>
      run('Complete trade', 'Trade completed and collateral released', () =>
        services!.trades.complete(tradeId),
      ),
    [run, services],
  );

  const verifySupplier = useCallback(
    (tradeId: bigint) =>
      run('Verify supplier', 'Supplier verified', () => services!.trades.verifySupplier(tradeId)),
    [run, services],
  );

  const advanceWithAttestation = useCallback(
    (tradeId: bigint, attestationId: Hex) =>
      run('Advance trade', 'Trade advanced by attestation', () =>
        services!.trades.advanceWithAttestation(tradeId, attestationId),
      ),
    [run, services],
  );

  const cancel = useCallback(
    (tradeId: bigint) =>
      run('Cancel trade', 'Trade cancelled and funds returned', () =>
        services!.trades.cancel(tradeId),
      ),
    [run, services],
  );

  const declareDefault = useCallback(
    (tradeId: bigint) =>
      run('Declare default', 'Default declared and collateral seized', () =>
        services!.trades.declareDefault(tradeId),
      ),
    [run, services],
  );

  const readLockedCollateral = useCallback(
    async (tradeId: bigint): Promise<bigint> => {
      if (!services) return 0n;
      return services.collateral.lockedOf(tradeId).catch(() => 0n);
    },
    [services],
  );

  return {
    state,
    ready: Boolean(services?.ready),
    createTrade,
    depositCollateral,
    commitFinancing,
    releaseFunds,
    repay,
    complete,
    verifySupplier,
    advanceWithAttestation,
    cancel,
    declareDefault,
    readLockedCollateral,
  };
}

export type {Address};
