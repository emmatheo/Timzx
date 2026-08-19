import type {Address, Hex} from 'viem';

import {collateralVaultAbi, tradeFinanceAbi} from '@/lib/abi';
import {contractAddresses} from '@/lib/config/env';
import {ChainService, type ServiceContext} from './context';
import {TokenService} from './token-service';

/**
 * Buyer collateral.
 *
 * Deposit is two transactions — approve the vault, then deposit — and the approval must name the
 * vault rather than TradeFinance, because the vault is what pulls the funds. Callers get one
 * method so that detail cannot be got wrong at a call site.
 */
export class CollateralService extends ChainService {
  private readonly tokens: TokenService;

  constructor(context: ServiceContext) {
    super(context);
    this.tokens = new TokenService(context);
  }

  private get vault(): Address {
    return this.requireAddress(contractAddresses.collateralVault, 'Collateral vault');
  }

  private get finance(): Address {
    return this.requireAddress(contractAddresses.tradeFinance, 'TradeFinance');
  }

  /** Collateral currently held against a trade, in settlement-token units. */
  async lockedOf(tradeId: bigint): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.vault,
      abi: collateralVaultAbi,
      functionName: 'lockedOf',
      args: [tradeId],
    });
  }

  /**
   * Locks the buyer's collateral, approving the vault first if needed.
   * @returns The approval hash when one was required, and the deposit hash.
   */
  async deposit(tradeId: bigint, amount: bigint): Promise<{approval: Hex | null; deposit: Hex}> {
    const {walletClient, account} = this.requireWallet();
    const approval = await this.tokens.ensureAllowance(this.vault, amount);

    const {request} = await this.publicClient.simulateContract({
      account,
      address: this.finance,
      abi: tradeFinanceAbi,
      functionName: 'depositCollateral',
      args: [tradeId],
    });
    return {approval, deposit: await this.confirm(await walletClient.writeContract(request))};
  }
}
