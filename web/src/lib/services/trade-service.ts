import type {Address, Hex} from 'viem';

import {repaymentManagerAbi, tradeFinanceAbi} from '@/lib/abi';
import {contractAddresses} from '@/lib/config/env';
import {ChainService, type ServiceContext} from './context';
import {TokenService} from './token-service';
import type {CreditRecord, OnChainTrade, TradeStateValue} from '@/types/trade';

interface RawTrade {
  id: bigint;
  buyer: Address;
  supplier: Address;
  financier: Address;
  terms: {
    tradeValue: bigint;
    collateral: bigint;
    financing: bigint;
    interestBps: number;
    termDays: number;
  };
  state: number;
  createdAt: bigint;
  fundedAt: bigint;
  maturityAt: bigint;
  metadataHash: Hex;
}

function toTrade(raw: RawTrade): OnChainTrade {
  return {
    id: raw.id,
    buyer: raw.buyer,
    supplier: raw.supplier,
    financier: raw.financier,
    terms: {
      tradeValue: raw.terms.tradeValue,
      collateral: raw.terms.collateral,
      financing: raw.terms.financing,
      interestBps: Number(raw.terms.interestBps),
      termDays: Number(raw.terms.termDays),
    },
    state: raw.state as TradeStateValue,
    createdAt: Number(raw.createdAt),
    fundedAt: Number(raw.fundedAt),
    maturityAt: Number(raw.maturityAt),
    metadataHash: raw.metadataHash,
  };
}

export interface CreateTradeInput {
  supplier: Address;
  tradeValue: bigint;
  collateral: bigint;
  interestBps: number;
  termDays: number;
  /** keccak256 over the off-chain document set. Documents stay off-chain; only the digest anchors. */
  metadataHash: Hex;
}

/**
 * The trade lifecycle.
 *
 * Every write simulates before signing. The protocol reverts with typed errors on an invalid
 * transition, so simulating converts "transaction failed" into a specific reason *before* the user
 * pays gas — and means this service never has to duplicate the state machine to guess what is
 * allowed. The contracts remain the authority; this is a client to them.
 */
export class TradeService extends ChainService {
  private readonly tokens: TokenService;

  constructor(context: ServiceContext) {
    super(context);
    this.tokens = new TokenService(context);
  }

  private get finance(): Address {
    return this.requireAddress(contractAddresses.tradeFinance, 'TradeFinance');
  }

  private get repayments(): Address {
    return this.requireAddress(contractAddresses.repaymentManager, 'Repayment manager');
  }

  async count(): Promise<number> {
    const total = await this.publicClient.readContract({
      address: this.finance,
      abi: tradeFinanceAbi,
      functionName: 'tradeCount',
    });
    return Number(total);
  }

  async get(tradeId: bigint): Promise<OnChainTrade | null> {
    const raw = await this.publicClient.readContract({
      address: this.finance,
      abi: tradeFinanceAbi,
      functionName: 'getTrade',
      args: [tradeId],
    });
    const trade = toTrade(raw as unknown as RawTrade);
    return trade.id === 0n ? null : trade;
  }

  async outstandingOf(tradeId: bigint): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.finance,
      abi: tradeFinanceAbi,
      functionName: 'outstandingOf',
      args: [tradeId],
    });
  }

  async isOverdue(tradeId: bigint): Promise<boolean> {
    return this.publicClient.readContract({
      address: this.repayments,
      abi: repaymentManagerAbi,
      functionName: 'isOverdue',
      args: [tradeId],
    });
  }

  async creditRecordOf(account: Address): Promise<CreditRecord> {
    const record = await this.publicClient.readContract({
      address: this.finance,
      abi: tradeFinanceAbi,
      functionName: 'creditRecordOf',
      args: [account],
    });
    return {
      tradesAsBuyer: Number(record.tradesAsBuyer),
      tradesCompleted: Number(record.tradesCompleted),
      tradesDefaulted: Number(record.tradesDefaulted),
      tradesFinanced: Number(record.tradesFinanced),
      volumeTransacted: record.volumeTransacted,
      volumeFinanced: record.volumeFinanced,
      volumeRepaid: record.volumeRepaid,
      cumulativeRepaymentDays: Number(record.cumulativeRepaymentDays),
    };
  }

  // -------------------------------------------------------------------------
  // Writes
  // -------------------------------------------------------------------------

  async create(input: CreateTradeInput): Promise<Hex> {
    return this.write('createTrade', [
      input.supplier,
      input.tradeValue,
      input.collateral,
      input.interestBps,
      input.termDays,
      input.metadataHash,
    ]);
  }

  async verifySupplier(tradeId: bigint): Promise<Hex> {
    return this.write('verifySupplier', [tradeId]);
  }

  async releaseFunds(tradeId: bigint): Promise<Hex> {
    return this.write('releaseFunds', [tradeId]);
  }

  /**
   * Repays against the outstanding obligation, approving the repayment manager first if needed.
   * Partial repayments are allowed; anything above the balance is clamped by the contract.
   */
  async repay(tradeId: bigint, amount: bigint): Promise<{approval: Hex | null; repay: Hex}> {
    const approval = await this.tokens.ensureAllowance(this.repayments, amount);
    return {approval, repay: await this.write('repay', [tradeId, amount])};
  }

  async complete(tradeId: bigint): Promise<Hex> {
    return this.write('complete', [tradeId]);
  }

  async declareDefault(tradeId: bigint): Promise<Hex> {
    return this.write('declareDefault', [tradeId]);
  }

  async cancel(tradeId: bigint): Promise<Hex> {
    return this.write('cancel', [tradeId]);
  }

  /** Applies a recorded, proof-backed attestation to a trade. */
  async advanceWithAttestation(tradeId: bigint, attestationId: Hex): Promise<Hex> {
    return this.write('advanceWithAttestation', [tradeId, attestationId]);
  }

  /** Simulate, sign, wait. The one place a TradeFinance write is issued. */
  private async write(
    functionName: string,
    args: readonly unknown[],
  ): Promise<Hex> {
    const {walletClient, account} = this.requireWallet();
    const {request} = await this.publicClient.simulateContract({
      account,
      address: this.finance,
      abi: tradeFinanceAbi,
      // The ABI is a const assertion, so viem narrows `functionName` and `args` per call. This
      // generic helper trades that narrowing for one code path; every caller above passes a
      // literal name and correctly shaped args.
      functionName: functionName as 'complete',
      args: args as readonly [bigint],
    });
    return this.confirm(await walletClient.writeContract(request));
  }
}
