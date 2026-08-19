/**
 * Source-chain event signatures.
 *
 * Derived from the Solidity declarations in `TradeEventEmitter.sol` with `keccak256`, so the
 * frontend, the deploy script and the adapter registry all agree by construction rather than by
 * three hand-copied hex constants.
 */
import {keccak256, toHex, type Hex} from 'viem';

import {EventKind, type EventKindValue} from '@/types/trade';

const signatures: Record<EventKindValue, string | null> = {
  [EventKind.UNKNOWN]: null,
  [EventKind.SUPPLIER_VERIFIED]: 'SupplierVerified(uint256,address,address,uint64)',
  [EventKind.SHIPMENT_CONFIRMED]: 'ShipmentConfirmed(uint256,bytes32,address,uint64)',
  [EventKind.DELIVERY_CONFIRMED]: 'DeliveryConfirmed(uint256,bytes32,address,uint64)',
  [EventKind.REPAYMENT_SETTLED]: 'RepaymentSettled(uint256,uint256,address,uint64)',
};

export function eventSignatureFor(kind: EventKindValue): string {
  const signature = signatures[kind];
  if (!signature) throw new Error(`No source-chain event signature for kind ${kind}`);
  return signature;
}

export function eventTopicFor(kind: EventKindValue): Hex {
  return keccak256(toHex(eventSignatureFor(kind)));
}
