'use client';

import {useQuery} from '@tanstack/react-query';
import {useCallback, useState} from 'react';
import {useAccount, useBalance} from 'wagmi';

import {useToast} from '@/components/ui/toast';
import {creditcoin, explorerTxUrl} from '@/lib/config/chains';
import {readableError} from '@/lib/services';
import {useServices} from './use-services';

/**
 * Testnet faucet.
 *
 * Cooldown, drip amount and reserve all come from the contract, so the interface cannot offer a
 * request the chain would reject. A failed request reports the failure — there is no simulated
 * success.
 */
export function useFaucet() {
  const {address} = useAccount();
  const services = useServices();
  const {push} = useToast();
  const [pending, setPending] = useState(false);

  const configured = services?.faucet.isAvailable ?? false;

  const state = useQuery({
    queryKey: ['faucet', address],
    enabled: configured && address !== undefined && services !== null,
    queryFn: () => services!.faucet.state(address as `0x${string}`),
  });

  const native = useBalance({address, chainId: creditcoin.id});

  const request = useCallback(async (): Promise<boolean> => {
    if (!services?.ready) {
      push({kind: 'error', title: 'Connect a wallet on Creditcoin first'});
      return false;
    }
    try {
      setPending(true);
      const hash = await services.faucet.request();
      push({
        kind: 'success',
        title: 'Testnet tokens sent',
        href: explorerTxUrl(creditcoin.id, hash) ?? undefined,
      });
      await state.refetch();
      return true;
    } catch (error) {
      push({kind: 'error', title: 'Faucet request failed', description: readableError(error)});
      return false;
    } finally {
      setPending(false);
    }
  }, [push, services, state]);

  return {
    configured,
    dripAmount: state.data?.dripAmount ?? 0n,
    cooldownSeconds: state.data?.cooldownSeconds ?? 0,
    availableAt: state.data?.availableAt ?? 0,
    lastRequestAt: state.data?.lastRequestAt ?? 0,
    faucetBalance: state.data?.reserve ?? 0n,
    nativeBalance: native.data?.value ?? 0n,
    nativeSymbol: native.data?.symbol ?? 'CTC',
    pending,
    request,
    refetch: state.refetch,
  };
}
