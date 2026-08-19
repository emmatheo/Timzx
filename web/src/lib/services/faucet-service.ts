import type {Address, Hex} from 'viem';

import {settlementTokenAbi, testnetFaucetAbi} from '@/lib/abi';
import {contractAddresses} from '@/lib/config/env';
import {ChainService} from './context';

export interface FaucetState {
  /** Units dispensed per request. */
  dripAmount: bigint;
  /** Seconds between requests for one wallet. */
  cooldownSeconds: number;
  /** Unix seconds at which this wallet may next request; 0 means now. */
  availableAt: number;
  lastRequestAt: number;
  /** Units the faucet still holds. */
  reserve: bigint;
}

/**
 * Testnet faucet.
 *
 * Every value comes from the contract, including the cooldown, so the interface cannot offer a
 * request the chain would reject. There is no simulated success path: a failed request surfaces
 * the failure.
 */
export class FaucetService extends ChainService {
  private get faucet(): Address {
    return this.requireAddress(contractAddresses.faucet, 'Testnet faucet');
  }

  private get token(): Address {
    return this.requireAddress(contractAddresses.settlementToken, 'Settlement token');
  }

  /** True when this deployment has a faucet at all — mainnet deployments will not. */
  get isAvailable(): boolean {
    return contractAddresses.faucet !== null && contractAddresses.settlementToken !== null;
  }

  async state(account: Address): Promise<FaucetState> {
    const [dripAmount, cooldown, availableAt, lastRequestAt, reserve] = await Promise.all([
      this.publicClient.readContract({
        address: this.faucet,
        abi: testnetFaucetAbi,
        functionName: 'dripAmount',
      }),
      this.publicClient.readContract({
        address: this.faucet,
        abi: testnetFaucetAbi,
        functionName: 'cooldown',
      }),
      this.publicClient.readContract({
        address: this.faucet,
        abi: testnetFaucetAbi,
        functionName: 'availableAt',
        args: [account],
      }),
      this.publicClient.readContract({
        address: this.faucet,
        abi: testnetFaucetAbi,
        functionName: 'lastRequestAt',
        args: [account],
      }),
      this.publicClient.readContract({
        address: this.token,
        abi: settlementTokenAbi,
        functionName: 'balanceOf',
        args: [this.faucet],
      }),
    ]);

    return {
      dripAmount,
      cooldownSeconds: Number(cooldown),
      availableAt: Number(availableAt),
      lastRequestAt: Number(lastRequestAt),
      reserve,
    };
  }

  async request(): Promise<Hex> {
    const {walletClient, account} = this.requireWallet();
    const {request} = await this.publicClient.simulateContract({
      account,
      address: this.faucet,
      abi: testnetFaucetAbi,
      functionName: 'request',
    });
    return this.confirm(await walletClient.writeContract(request));
  }
}
