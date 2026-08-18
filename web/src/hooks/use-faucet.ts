'use client';

import {useCallback, useState} from 'react';
import {useAccount, useBalance, usePublicClient, useReadContracts, useWalletClient} from 'wagmi';

import {settlementTokenAbi, testnetFaucetAbi} from '@/lib/abi';
import {creditcoin, explorerTxUrl} from '@/lib/config/chains';
import {contractAddresses} from '@/lib/config/env';
import {useToast} from '@/components/ui/toast';

/**
 * Testnet faucet.
 *
 * Cooldown, drip amount and remaining balance all come from the contract, so the UI cannot show a
 * request as available when the chain would reject it. There is no simulated success path: if the
 * transaction fails, the failure is what gets shown.
 */
export function useFaucet() {
  const {address} = useAccount();
  const publicClient = usePublicClient({chainId: creditcoin.id});
  const {data: walletClient} = useWalletClient({chainId: creditcoin.id});
  const {push} = useToast();
  const [pending, setPending] = useState(false);

  const faucet = contractAddresses.faucet;
  const token = contractAddresses.settlementToken;

  const {data, refetch} = useReadContracts({
    contracts:
      faucet && token
        ? [
            {
              address: faucet,
              abi: testnetFaucetAbi,
              chainId: creditcoin.id,
              functionName: 'dripAmount',
            } as const,
            {
              address: faucet,
              abi: testnetFaucetAbi,
              chainId: creditcoin.id,
              functionName: 'cooldown',
            } as const,
            {
              address: faucet,
              abi: testnetFaucetAbi,
              chainId: creditcoin.id,
              functionName: 'availableAt',
              args: [address ?? '0x0000000000000000000000000000000000000000'],
            } as const,
            {
              address: faucet,
              abi: testnetFaucetAbi,
              chainId: creditcoin.id,
              functionName: 'lastRequestAt',
              args: [address ?? '0x0000000000000000000000000000000000000000'],
            } as const,
            {
              address: token,
              abi: settlementTokenAbi,
              chainId: creditcoin.id,
              functionName: 'balanceOf',
              args: [faucet],
            } as const,
          ]
        : [],
    query: {enabled: faucet !== null && token !== null},
  });

  const native = useBalance({address, chainId: creditcoin.id});

  const request = useCallback(async () => {
    if (!faucet || !publicClient || !walletClient || !address) {
      push({kind: 'error', title: 'Connect a wallet on Creditcoin first'});
      return false;
    }
    try {
      setPending(true);
      const {request: simulated} = await publicClient.simulateContract({
        account: address,
        address: faucet,
        abi: testnetFaucetAbi,
        functionName: 'request',
      });
      const hash = await walletClient.writeContract(simulated);
      await publicClient.waitForTransactionReceipt({hash});
      push({
        kind: 'success',
        title: 'Testnet tokens sent',
        href: explorerTxUrl(creditcoin.id, hash) ?? undefined,
      });
      await refetch();
      return true;
    } catch (error) {
      push({
        kind: 'error',
        title: 'Faucet request failed',
        description:
          error instanceof Error ? (error.message.split('\n')[0] ?? '') : 'Unknown error',
      });
      return false;
    } finally {
      setPending(false);
    }
  }, [address, faucet, publicClient, push, refetch, walletClient]);

  const read = <T,>(index: number): T | null => {
    const entry = data?.[index];
    return entry?.status === 'success' ? (entry.result as T) : null;
  };

  return {
    configured: faucet !== null && token !== null,
    dripAmount: read<bigint>(0) ?? 0n,
    cooldownSeconds: Number(read<bigint>(1) ?? 0n),
    availableAt: Number(read<bigint>(2) ?? 0n),
    lastRequestAt: Number(read<bigint>(3) ?? 0n),
    faucetBalance: read<bigint>(4) ?? 0n,
    nativeBalance: native.data?.value ?? 0n,
    nativeSymbol: native.data?.symbol ?? 'CTC',
    pending,
    request,
    refetch,
  };
}
