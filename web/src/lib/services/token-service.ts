import type {Address, Hex} from 'viem';

import {settlementTokenAbi} from '@/lib/abi';
import {contractAddresses} from '@/lib/config/env';
import {ChainService} from './context';

/**
 * The settlement token every other service moves.
 *
 * Exists mainly for {@link TokenService.ensureAllowance}. Each protocol module custodies its own
 * funds and therefore pulls them itself, so the allowance has to name the module that will do the
 * pulling — approving TradeFinance for a collateral deposit silently fails, because the vault is
 * what calls `transferFrom`. Getting that wrong is the single easiest mistake to make here, so no
 * other service builds an approval by hand.
 */
export class TokenService extends ChainService {
  private get token(): Address {
    return this.requireAddress(contractAddresses.settlementToken, 'Settlement token');
  }

  async balanceOf(account: Address): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.token,
      abi: settlementTokenAbi,
      functionName: 'balanceOf',
      args: [account],
    });
  }

  async allowance(owner: Address, spender: Address): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.token,
      abi: settlementTokenAbi,
      functionName: 'allowance',
      args: [owner, spender],
    });
  }

  async metadata(): Promise<{symbol: string; decimals: number}> {
    const [symbol, decimals] = await Promise.all([
      this.publicClient.readContract({
        address: this.token,
        abi: settlementTokenAbi,
        functionName: 'symbol',
      }),
      this.publicClient.readContract({
        address: this.token,
        abi: settlementTokenAbi,
        functionName: 'decimals',
      }),
    ]);
    return {symbol, decimals: Number(decimals)};
  }

  /**
   * Approves `spender` for `amount` when the current allowance is short.
   *
   * Returns the approval hash, or null when no approval was needed — so callers can tell a
   * one-transaction flow from a two-transaction one and say so in the UI.
   */
  async ensureAllowance(spender: Address, amount: bigint): Promise<Hex | null> {
    const {walletClient, account} = this.requireWallet();
    const owner = typeof account === 'string' ? account : account.address;

    const current = await this.allowance(owner, spender);
    if (current >= amount) return null;

    const {request} = await this.publicClient.simulateContract({
      account,
      address: this.token,
      abi: settlementTokenAbi,
      functionName: 'approve',
      args: [spender, amount],
    });
    return this.confirm(await walletClient.writeContract(request));
  }
}
