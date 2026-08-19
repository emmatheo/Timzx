import type {Account, Address, Hex, PublicClient, WalletClient} from 'viem';

import {contractAddresses} from '@/lib/config/env';

/**
 * What every service needs to talk to Creditcoin.
 *
 * Services are constructed with clients rather than creating their own, so the same class works
 * against a connected browser wallet, a test harness, or a script — and so nothing in this layer
 * can quietly reach for a key of its own.
 */
export interface ServiceContext {
  publicClient: PublicClient;
  /** Absent when the caller is only reading. Every write path checks for it explicitly. */
  walletClient?: WalletClient | undefined;
}

export type ContractAddresses = typeof contractAddresses;

/** Thrown when a service is asked to do something the current deployment cannot support. */
export class ServiceUnavailableError extends Error {
  constructor(what: string) {
    super(`${what} is not available on this deployment.`);
    this.name = 'ServiceUnavailableError';
  }
}

/** Thrown when a write is attempted without a connected wallet. */
export class WalletRequiredError extends Error {
  constructor() {
    super('Connect a wallet to sign this transaction.');
    this.name = 'WalletRequiredError';
  }
}

/**
 * Turns a viem revert into something a person can act on.
 *
 * Contract errors arrive as multi-line dumps with the useful sentence buried in the middle. The
 * protocol reverts with typed errors on every invalid transition, so surfacing the name is usually
 * the whole diagnosis.
 */
export function readableError(error: unknown): string {
  if (!(error instanceof Error)) return 'Transaction failed.';
  const reason = /reverted with the following reason:\s*(.+)/i.exec(error.message);
  if (reason?.[1]) return reason[1].split('\n')[0] ?? reason[1];
  const custom = /Error:\s*(\w+)\(/.exec(error.message);
  if (custom?.[1]) return `Rejected by contract: ${custom[1]}`;
  if (error.message.includes('User rejected')) return 'Signature rejected in wallet.';
  return error.message.split('\n')[0] ?? 'Transaction failed.';
}

/**
 * Base for services that write.
 *
 * Holds the one invariant that matters across all of them: a service never owns a key. It is given
 * a wallet client that belongs to the connected account, simulates before asking for a signature,
 * and returns the hash. Nothing here can move funds without the account holder signing.
 */
export abstract class ChainService {
  constructor(protected readonly context: ServiceContext) {}

  protected get publicClient(): PublicClient {
    return this.context.publicClient;
  }

  /** The wallet client and its account, or a typed failure if the caller is not connected. */
  protected requireWallet(): {walletClient: WalletClient; account: Account | Address} {
    const walletClient = this.context.walletClient;
    const account = walletClient?.account;
    if (!walletClient || !account) throw new WalletRequiredError();
    return {walletClient, account};
  }

  protected requireAddress(address: Address | null, what: string): Address {
    if (!address) throw new ServiceUnavailableError(what);
    return address;
  }

  /** Waits for inclusion so callers can refresh against settled state rather than a pending tx. */
  protected async confirm(hash: Hex): Promise<Hex> {
    await this.publicClient.waitForTransactionReceipt({hash});
    return hash;
  }
}
