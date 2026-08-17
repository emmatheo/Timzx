'use client';

import {useCallback, useState} from 'react';
import {useAccount, usePublicClient, useWalletClient} from 'wagmi';
import type {Address, Hex} from 'viem';

import {collateralVaultAbi, testUSDAbi, tradeFinanceAbi} from '@/lib/abi';
import {creditcoin, explorerTxUrl} from '@/lib/config/chains';
import {contractAddresses} from '@/lib/config/env';
import {useToast} from '@/components/ui/toast';

/**
 * Write paths for the trade lifecycle.
 *
 * Two things every action here does, and neither is optional:
 *
 *  - `simulateContract` before signing. The protocol reverts with typed errors on invalid
 *    transitions, so simulating turns "transaction failed" into a specific, readable reason
 *    *before* the user pays gas or signs anything.
 *  - ERC-20 allowance is checked against the exact module that will pull the funds — the vault for
 *    collateral, the escrow for financing, the repayment manager for repayments — because each
 *    custodies its own money and approving the wrong one silently fails.
 */
export interface ActionState {
  pending: boolean;
  /** Which step is in flight, so the UI can say "approving" vs "depositing". */
  step: string | null;
  error: string | null;
}

const idle: ActionState = {pending: false, step: null, error: null};

/** Extracts a readable reason from a viem revert without dumping a stack at the user. */
function readableError(error: unknown): string {
  if (error instanceof Error) {
    const match = /reverted with the following reason:\s*(.+)/i.exec(error.message);
    if (match?.[1]) return match[1].split('\n')[0] ?? match[1];
    const custom = /Error:\s*(\w+)\(/.exec(error.message);
    if (custom?.[1]) return `Rejected by contract: ${custom[1]}`;
    if (error.message.includes('User rejected')) return 'Signature rejected in wallet.';
    return error.message.split('\n')[0] ?? 'Transaction failed.';
  }
  return 'Transaction failed.';
}

export function useTradeActions(onSettled?: () => void | Promise<void>) {
  const {address} = useAccount();
  const publicClient = usePublicClient({chainId: creditcoin.id});
  const {data: walletClient} = useWalletClient({chainId: creditcoin.id});
  const {push} = useToast();
  const [state, setState] = useState<ActionState>(idle);

  const notifySuccess = useCallback(
    (title: string, hash: Hex) => {
      push({
        kind: 'success',
        title,
        href: explorerTxUrl(creditcoin.id, hash) ?? undefined,
      });
    },
    [push],
  );

  /** Approves `spender` for `amount` when the current allowance is short. */
  const ensureAllowance = useCallback(
    async (spender: Address, amount: bigint) => {
      if (!publicClient || !walletClient || !address) throw new Error('Wallet not connected.');
      const token = contractAddresses.settlementToken;
      if (!token) throw new Error('Settlement token is not configured.');

      const allowance = await publicClient.readContract({
        address: token,
        abi: testUSDAbi,
        functionName: 'allowance',
        args: [address, spender],
      });
      if (allowance >= amount) return;

      setState({pending: true, step: 'Approving settlement token', error: null});
      const {request} = await publicClient.simulateContract({
        account: address,
        address: token,
        abi: testUSDAbi,
        functionName: 'approve',
        args: [spender, amount],
      });
      const hash = await walletClient.writeContract(request);
      await publicClient.waitForTransactionReceipt({hash});
    },
    [address, publicClient, walletClient],
  );

  /** Runs a protocol write with simulation, confirmation and consistent error reporting. */
  const run = useCallback(
    async (
      step: string,
      successTitle: string,
      build: () => Promise<{hash: Hex}>,
    ): Promise<boolean> => {
      if (!publicClient || !walletClient || !address) {
        push({kind: 'error', title: 'Connect a wallet first'});
        return false;
      }
      try {
        setState({pending: true, step, error: null});
        const {hash} = await build();
        await publicClient.waitForTransactionReceipt({hash});
        notifySuccess(successTitle, hash);
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
    [address, notifySuccess, onSettled, publicClient, push, walletClient],
  );

  const requireFinance = useCallback((): Address => {
    const finance = contractAddresses.tradeFinance;
    if (!finance) throw new Error('TradeFinance is not deployed on this network.');
    return finance;
  }, []);

  const createTrade = useCallback(
    async (params: {
      supplier: Address;
      tradeValue: bigint;
      collateral: bigint;
      interestBps: number;
      termDays: number;
      metadataHash: Hex;
    }) =>
      run('Create trade', 'Trade created', async () => {
        const finance = requireFinance();
        const {request} = await publicClient!.simulateContract({
          account: address!,
          address: finance,
          abi: tradeFinanceAbi,
          functionName: 'createTrade',
          args: [
            params.supplier,
            params.tradeValue,
            params.collateral,
            params.interestBps,
            params.termDays,
            params.metadataHash,
          ],
        });
        return {hash: await walletClient!.writeContract(request)};
      }),
    [address, publicClient, requireFinance, run, walletClient],
  );

  const depositCollateral = useCallback(
    async (tradeId: bigint, collateral: bigint) =>
      run('Deposit collateral', 'Collateral locked', async () => {
        const finance = requireFinance();
        const vault = contractAddresses.collateralVault;
        if (!vault) throw new Error('Collateral vault is not deployed.');
        // The vault pulls the funds, so the vault is what must be approved.
        await ensureAllowance(vault, collateral);
        setState({pending: true, step: 'Depositing collateral', error: null});
        const {request} = await publicClient!.simulateContract({
          account: address!,
          address: finance,
          abi: tradeFinanceAbi,
          functionName: 'depositCollateral',
          args: [tradeId],
        });
        return {hash: await walletClient!.writeContract(request)};
      }),
    [address, ensureAllowance, publicClient, requireFinance, run, walletClient],
  );

  const commitFinancing = useCallback(
    async (tradeId: bigint, financing: bigint) =>
      run('Commit financing', 'Financing committed to escrow', async () => {
        const finance = requireFinance();
        const escrow = contractAddresses.tradeEscrow;
        if (!escrow) throw new Error('Trade escrow is not deployed.');
        await ensureAllowance(escrow, financing);
        setState({pending: true, step: 'Committing financing', error: null});
        const {request} = await publicClient!.simulateContract({
          account: address!,
          address: finance,
          abi: tradeFinanceAbi,
          functionName: 'commitFinancing',
          args: [tradeId],
        });
        return {hash: await walletClient!.writeContract(request)};
      }),
    [address, ensureAllowance, publicClient, requireFinance, run, walletClient],
  );

  const releaseFunds = useCallback(
    async (tradeId: bigint) =>
      run('Release funds', 'Funds released to supplier', async () => {
        const finance = requireFinance();
        const {request} = await publicClient!.simulateContract({
          account: address!,
          address: finance,
          abi: tradeFinanceAbi,
          functionName: 'releaseFunds',
          args: [tradeId],
        });
        return {hash: await walletClient!.writeContract(request)};
      }),
    [address, publicClient, requireFinance, run, walletClient],
  );

  const repay = useCallback(
    async (tradeId: bigint, amount: bigint) =>
      run('Repay', 'Repayment settled', async () => {
        const finance = requireFinance();
        const manager = contractAddresses.repaymentManager;
        if (!manager) throw new Error('Repayment manager is not deployed.');
        await ensureAllowance(manager, amount);
        setState({pending: true, step: 'Submitting repayment', error: null});
        const {request} = await publicClient!.simulateContract({
          account: address!,
          address: finance,
          abi: tradeFinanceAbi,
          functionName: 'repay',
          args: [tradeId, amount],
        });
        return {hash: await walletClient!.writeContract(request)};
      }),
    [address, ensureAllowance, publicClient, requireFinance, run, walletClient],
  );

  const complete = useCallback(
    async (tradeId: bigint) =>
      run('Complete trade', 'Trade completed and collateral released', async () => {
        const finance = requireFinance();
        const {request} = await publicClient!.simulateContract({
          account: address!,
          address: finance,
          abi: tradeFinanceAbi,
          functionName: 'complete',
          args: [tradeId],
        });
        return {hash: await walletClient!.writeContract(request)};
      }),
    [address, publicClient, requireFinance, run, walletClient],
  );

  const verifySupplier = useCallback(
    async (tradeId: bigint) =>
      run('Verify supplier', 'Supplier verified', async () => {
        const finance = requireFinance();
        const {request} = await publicClient!.simulateContract({
          account: address!,
          address: finance,
          abi: tradeFinanceAbi,
          functionName: 'verifySupplier',
          args: [tradeId],
        });
        return {hash: await walletClient!.writeContract(request)};
      }),
    [address, publicClient, requireFinance, run, walletClient],
  );

  const advanceWithAttestation = useCallback(
    async (tradeId: bigint, attestationId: Hex) =>
      run('Advance trade', 'Trade advanced by attestation', async () => {
        const finance = requireFinance();
        const {request} = await publicClient!.simulateContract({
          account: address!,
          address: finance,
          abi: tradeFinanceAbi,
          functionName: 'advanceWithAttestation',
          args: [tradeId, attestationId],
        });
        return {hash: await walletClient!.writeContract(request)};
      }),
    [address, publicClient, requireFinance, run, walletClient],
  );

  const cancel = useCallback(
    async (tradeId: bigint) =>
      run('Cancel trade', 'Trade cancelled and funds returned', async () => {
        const finance = requireFinance();
        const {request} = await publicClient!.simulateContract({
          account: address!,
          address: finance,
          abi: tradeFinanceAbi,
          functionName: 'cancel',
          args: [tradeId],
        });
        return {hash: await walletClient!.writeContract(request)};
      }),
    [address, publicClient, requireFinance, run, walletClient],
  );

  /** Reads collateral currently held, used to confirm release amounts before completion. */
  const readLockedCollateral = useCallback(
    async (tradeId: bigint): Promise<bigint> => {
      const vault = contractAddresses.collateralVault;
      if (!vault || !publicClient) return 0n;
      return publicClient.readContract({
        address: vault,
        abi: collateralVaultAbi,
        functionName: 'lockedOf',
        args: [tradeId],
      });
    },
    [publicClient],
  );

  return {
    state,
    ready: Boolean(address && walletClient && publicClient && contractAddresses.tradeFinance),
    createTrade,
    depositCollateral,
    commitFinancing,
    releaseFunds,
    repay,
    complete,
    verifySupplier,
    advanceWithAttestation,
    cancel,
    readLockedCollateral,
  };
}
