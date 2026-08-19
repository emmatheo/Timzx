'use client';

import {useMemo} from 'react';
import {usePublicClient, useWalletClient} from 'wagmi';

import {creditcoin} from '@/lib/config/chains';
import {
  CollateralService,
  DocumentService,
  FaucetService,
  FinancingService,
  TokenService,
  TradeService,
  type ServiceContext,
} from '@/lib/services';

export interface Services {
  trades: TradeService;
  collateral: CollateralService;
  financing: FinancingService;
  tokens: TokenService;
  faucet: FaucetService;
  documents: DocumentService;
  /** False until a public client exists; every write also needs a connected wallet. */
  ready: boolean;
}

/**
 * Constructs the service layer from the connected clients.
 *
 * Rebuilt when the wallet changes so a service can never hold a client for an account the user has
 * since switched away from — signing with a stale client is the kind of bug that only shows up
 * with two accounts and is miserable to trace.
 */
export function useServices(): Services | null {
  const publicClient = usePublicClient({chainId: creditcoin.id});
  const {data: walletClient} = useWalletClient({chainId: creditcoin.id});

  return useMemo(() => {
    if (!publicClient) return null;
    const context: ServiceContext = {publicClient, walletClient};
    return {
      trades: new TradeService(context),
      collateral: new CollateralService(context),
      financing: new FinancingService(context),
      tokens: new TokenService(context),
      faucet: new FaucetService(context),
      documents: new DocumentService(),
      ready: Boolean(walletClient?.account),
    };
  }, [publicClient, walletClient]);
}
