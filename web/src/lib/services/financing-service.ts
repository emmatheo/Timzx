import type {Address, Hex} from 'viem';

import {tradeFinanceAbi} from '@/lib/abi';
import {contractAddresses} from '@/lib/config/env';
import {ChainService, type ServiceContext} from './context';
import {TokenService} from './token-service';
import {impliedApr, loanToValue, totalRepayable} from '@/lib/finance';
import type {TradeTerms} from '@/types/trade';

/** What a financier is committing, and what they get back if the trade performs. */
export interface FinancingQuote {
  /** Capital committed now. */
  outlay: bigint;
  /** Principal plus fixed interest, due at maturity. */
  expectedReturn: bigint;
  /** Interest earned if the trade repays in full. */
  interest: bigint;
  /** Financing measured against collateral, as a percentage. Above 100% by construction. */
  ltv: number;
  /** Annualised equivalent of the fixed charge, for comparison across terms. */
  impliedApr: number;
  /**
   * Principal the collateral does not cover.
   *
   * The number a financier most needs and is least often shown: on default the collateral is
   * seized, and this is what remains unrecovered.
   */
  uncovered: bigint;
}

/** Financing commitment and the arithmetic behind it. */
export class FinancingService extends ChainService {
  private readonly tokens: TokenService;

  constructor(context: ServiceContext) {
    super(context);
    this.tokens = new TokenService(context);
  }

  private get escrow(): Address {
    return this.requireAddress(contractAddresses.tradeEscrow, 'Trade escrow');
  }

  private get finance(): Address {
    return this.requireAddress(contractAddresses.tradeFinance, 'TradeFinance');
  }

  /** Derived entirely from terms; no chain read, so it is safe to call while rendering. */
  quote(terms: TradeTerms): FinancingQuote {
    const expectedReturn = totalRepayable(terms.financing, terms.interestBps);
    return {
      outlay: terms.financing,
      expectedReturn,
      interest: expectedReturn - terms.financing,
      ltv: loanToValue(terms),
      impliedApr: impliedApr(terms.interestBps, terms.termDays),
      uncovered:
        terms.financing > terms.collateral ? terms.financing - terms.collateral : 0n,
    };
  }

  /**
   * Commits the full financing amount into escrow, approving the escrow first if needed.
   *
   * All-or-nothing: partial participation would change the repayment split and the default
   * waterfall, which the protocol deliberately does not model.
   */
  async commit(tradeId: bigint, amount: bigint): Promise<{approval: Hex | null; commit: Hex}> {
    const {walletClient, account} = this.requireWallet();
    const approval = await this.tokens.ensureAllowance(this.escrow, amount);

    const {request} = await this.publicClient.simulateContract({
      account,
      address: this.finance,
      abi: tradeFinanceAbi,
      functionName: 'commitFinancing',
      args: [tradeId],
    });
    return {approval, commit: await this.confirm(await walletClient.writeContract(request))};
  }
}
