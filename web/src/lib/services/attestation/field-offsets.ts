/**
 * Resolving QueryBuilder field offsets.
 *
 * `UscAttestationAdapter` verifies inclusion and then reads four 32-byte words out of the proven
 * transaction encoding to bind it to a trade. Those byte offsets are not constants: they are
 * produced off-chain by `QueryBuilder.build()` in the gluwa usc-sdk package, computed against the
 * same `abiEncode(tx, receipt)` buffer the proof covers, and they depend on the source chain's
 * `chainEncoding` as reported by the ChainInfo precompile.
 *
 * This module is the one place that decides where the offsets come from. It deliberately does NOT
 * guess them. Guessed offsets would make `submitProof` revert at best and bind a proof to the
 * wrong bytes at worst, which is exactly the failure the adapter exists to prevent.
 */
import type {Address, Hex} from 'viem';

import type {QueryFieldOffsets} from './types';

export interface OffsetRequest {
  chainKey: number;
  /** Canonically encoded transaction the proof covers. */
  txBytes: Hex;
  /** Emitting contract on the source chain. */
  emitter: Address;
  /** Event signature of the log being bound. */
  topic0: Hex;
  /** Index of the matching log within the receipt. */
  logIndex: number;
}

export interface FieldOffsetResolver {
  readonly name: string;
  resolve(request: OffsetRequest): Promise<QueryFieldOffsets>;
}

export class FieldOffsetsUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FieldOffsetsUnavailableError';
  }
}

/**
 * Offsets supplied by configuration.
 *
 * Intended for a deployment where a developer has run the SDK QueryBuilder once against a sample
 * transaction from the source-chain emitter and pinned the resulting offsets. Valid because every
 * `TradeEventEmitter` event has the same argument shape, so the layout is stable per chain
 * encoding — but it is pinned per environment, never assumed.
 */
export class StaticFieldOffsetResolver implements FieldOffsetResolver {
  readonly name = 'static';

  constructor(private readonly offsets: QueryFieldOffsets) {}

  async resolve(): Promise<QueryFieldOffsets> {
    return this.offsets;
  }
}

/**
 * The real resolver, backed by the SDK QueryBuilder.
 *
 * Not implemented. Wiring it requires `@gluwa/usc-sdk`'s `QueryBuilder` — `setAbiProvider`,
 * `eventBuilder`, `addStaticField(RxStatus)` — driven against a live source-chain transaction, and
 * the exact call sequence should be taken from the Creditcoin USC tutorials rather than inferred.
 *
 * It throws a specific, actionable error instead of returning plausible numbers. That is the
 * honest failure: a wrong offset silently binds a proof to the wrong bytes, so an unimplemented
 * resolver must never fall back to a guess.
 */
export class SdkFieldOffsetResolver implements FieldOffsetResolver {
  readonly name = 'usc-sdk';

  async resolve(request: OffsetRequest): Promise<QueryFieldOffsets> {
    throw new FieldOffsetsUnavailableError(
      [
        'QueryBuilder field offsets are not wired up yet.',
        `Run the gluwa usc-sdk QueryBuilder against a ${request.emitter} transaction on chainKey`,
        `${request.chainKey} to obtain the {offset,size} map for rxStatus, the log address, topic0`,
        'and the tradeId argument, then set NEXT_PUBLIC_QUERY_OFFSET_* to pin them.',
      ].join(' '),
    );
  }
}

/** Reads pinned offsets from configuration, or null when they are not all present. */
export function offsetsFromEnv(): QueryFieldOffsets | null {
  const values = [
    process.env.NEXT_PUBLIC_QUERY_OFFSET_RX_STATUS,
    process.env.NEXT_PUBLIC_QUERY_OFFSET_LOG_ADDRESS,
    process.env.NEXT_PUBLIC_QUERY_OFFSET_TOPIC0,
    process.env.NEXT_PUBLIC_QUERY_OFFSET_TRADE_ID,
  ].map((raw) => (raw === undefined ? Number.NaN : Number(raw)));

  if (values.some((value) => !Number.isInteger(value) || value < 0)) return null;

  const [rxStatus, logAddress, topic0, tradeId] = values as [number, number, number, number];
  return {rxStatus, logAddress, topic0, tradeId};
}

/** The resolver this deployment should use: pinned offsets when configured, else the SDK path. */
export function defaultFieldOffsetResolver(): FieldOffsetResolver {
  const pinned = offsetsFromEnv();
  return pinned ? new StaticFieldOffsetResolver(pinned) : new SdkFieldOffsetResolver();
}
