/**
 * Presentation metadata for trade states and attestation kinds.
 *
 * Centralised so a state's label, tone and icon are identical on the dashboard table, the
 * marketplace card and the detail timeline. A state cannot pick up a different colour in one view
 * and confuse someone reading two screens side by side.
 */
import {
  Ban,
  BadgeCheck,
  CheckCircle2,
  CircleDollarSign,
  FileText,
  Landmark,
  PackageCheck,
  ShieldCheck,
  Ship,
  Truck,
  Wallet,
  XCircle,
  type LucideIcon,
} from 'lucide-react';

import {EventKind, ProofKind, TradeState, type EventKindValue, type ProofKindValue, type TradeStateValue} from '@/types/trade';

export type Tone = 'neutral' | 'accent' | 'positive' | 'warning' | 'danger' | 'info';

export interface StatePresentation {
  label: string;
  /** Shown under the label on the timeline: what this state means in trade terms. */
  description: string;
  tone: Tone;
  icon: LucideIcon;
}

const presentation: Record<TradeStateValue, StatePresentation> = {
  [TradeState.APPLICATION]: {
    label: 'Application',
    description: 'Trade submitted by the buyer and awaiting supplier verification.',
    tone: 'neutral',
    icon: FileText,
  },
  [TradeState.SUPPLIER_VERIFIED]: {
    label: 'Supplier verified',
    description: 'Supplier identity and eligibility confirmed for this corridor.',
    tone: 'info',
    icon: BadgeCheck,
  },
  [TradeState.COLLATERAL_LOCKED]: {
    label: 'Collateral locked',
    description: 'Buyer contribution held in the collateral vault for the life of the trade.',
    tone: 'info',
    icon: ShieldCheck,
  },
  [TradeState.FINANCING_APPROVED]: {
    label: 'Financing approved',
    description: 'Financier capital committed to escrow, not yet released.',
    tone: 'accent',
    icon: Landmark,
  },
  [TradeState.FUNDED]: {
    label: 'Funded',
    description: 'Escrow released to the supplier. The repayment clock has started.',
    tone: 'accent',
    icon: Wallet,
  },
  [TradeState.SHIPPED]: {
    label: 'Shipped',
    description: 'Shipment confirmed by a cross-chain event.',
    tone: 'accent',
    icon: Ship,
  },
  [TradeState.DELIVERED]: {
    label: 'Delivered',
    description: 'Delivery confirmed by a cross-chain event. Repayment may begin.',
    tone: 'accent',
    icon: PackageCheck,
  },
  [TradeState.REPAYING]: {
    label: 'Repaying',
    description: 'Partial repayment received. A balance remains outstanding.',
    tone: 'warning',
    icon: CircleDollarSign,
  },
  [TradeState.REPAID]: {
    label: 'Repaid',
    description: 'Outstanding balance cleared in full.',
    tone: 'positive',
    icon: CheckCircle2,
  },
  [TradeState.COMPLETED]: {
    label: 'Completed',
    description: 'Trade closed and collateral returned to the buyer.',
    tone: 'positive',
    icon: CheckCircle2,
  },
  [TradeState.DEFAULTED]: {
    label: 'Defaulted',
    description: 'Matured with a balance outstanding. Collateral transferred to the financier.',
    tone: 'danger',
    icon: XCircle,
  },
  [TradeState.CANCELLED]: {
    label: 'Cancelled',
    description: 'Closed before disbursement. Committed funds returned.',
    tone: 'neutral',
    icon: Ban,
  },
};

export function statePresentation(state: TradeStateValue): StatePresentation {
  return presentation[state] ?? presentation[TradeState.APPLICATION];
}

export interface EventPresentation {
  label: string;
  icon: LucideIcon;
}

const eventPresentation: Record<EventKindValue, EventPresentation> = {
  [EventKind.UNKNOWN]: {label: 'Unknown event', icon: FileText},
  [EventKind.SUPPLIER_VERIFIED]: {label: 'SupplierVerified', icon: BadgeCheck},
  [EventKind.SHIPMENT_CONFIRMED]: {label: 'ShipmentConfirmed', icon: Ship},
  [EventKind.DELIVERY_CONFIRMED]: {label: 'DeliveryConfirmed', icon: Truck},
  [EventKind.REPAYMENT_SETTLED]: {label: 'RepaymentSettled', icon: CircleDollarSign},
};

export function eventKindPresentation(kind: EventKindValue): EventPresentation {
  return eventPresentation[kind] ?? eventPresentation[EventKind.UNKNOWN];
}

/**
 * How to describe an attestation's provenance.
 *
 * The wording here is load-bearing. A demo-operator record is never called "verified" — it is an
 * unverified assertion, and the copy says so on every surface it appears.
 */
export interface ProofPresentation {
  label: string;
  detail: string;
  tone: Tone;
}

const proofPresentation: Record<ProofKindValue, ProofPresentation> = {
  [ProofKind.NONE]: {
    label: 'Not recorded',
    detail: 'No attestation exists for this event.',
    tone: 'neutral',
  },
  [ProofKind.USC_PROOF]: {
    label: 'Verified via USC',
    detail:
      'Inclusion proof verified on Creditcoin by the block-prover precompile, and bound to this trade.',
    tone: 'positive',
  },
  [ProofKind.DEMO_OPERATOR]: {
    label: 'Unverified — demo assertion',
    detail:
      'Asserted by a permissioned testnet operator. Nothing was cryptographically proven. This is not a USC proof.',
    tone: 'warning',
  },
};

export function proofKindPresentation(kind: ProofKindValue): ProofPresentation {
  return proofPresentation[kind] ?? proofPresentation[ProofKind.NONE];
}
