'use client';

import {FlaskConical, Radio, ShieldAlert} from 'lucide-react';

import {Badge} from './badge';
import {cn} from './cn';
import {attestationMode, isChainConfigured} from '@/lib/config/env';
import {activeNetworkName} from '@/lib/config/chains';

/**
 * Provenance labelling.
 *
 * Three distinct things get shown in this product and they must never be confused: state read from
 * a chain, records the app produced without proving anything, and seed rows that exist only to
 * populate an empty marketplace. Each has its own badge and its own wording.
 */
export type DataOrigin = 'chain' | 'demo-attestation' | 'seed';

export function DataOriginBadge({origin, className}: {origin: DataOrigin; className?: string}) {
  if (origin === 'chain') {
    return (
      <Badge tone="info" icon={Radio} className={className}>
        On-chain
      </Badge>
    );
  }
  if (origin === 'demo-attestation') {
    return (
      <Badge tone="warning" icon={ShieldAlert} className={className}>
        Unverified assertion
      </Badge>
    );
  }
  return (
    <Badge tone="neutral" icon={FlaskConical} className={className}>
      Demo data
    </Badge>
  );
}

/**
 * Persistent banner describing what the current deployment can and cannot prove.
 * Shown on every page of the shell, because "which mode am I in" should never require digging.
 */
export function DeploymentBanner({className}: {className?: string}) {
  const proving = attestationMode === 'usc';

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border px-3 py-2 text-[12px] leading-relaxed',
        proving
          ? 'border-info/30 bg-info-soft text-ink-muted'
          : 'border-warning/30 bg-warning-soft text-ink-muted',
        className,
      )}
    >
      <Badge tone={proving ? 'info' : 'warning'} icon={proving ? Radio : ShieldAlert}>
        {proving ? 'USC proving mode' : 'Demo attestation mode'}
      </Badge>
      <span>
        {proving
          ? 'Cross-chain events are proved against the Creditcoin block-prover precompile before any trade advances.'
          : 'Cross-chain events are asserted by a permissioned testnet operator. Nothing is cryptographically proven.'}
      </span>
      <span className="text-ink-subtle">
        Network: {activeNetworkName}
        {isChainConfigured ? '' : ' — contracts not deployed'}
      </span>
    </div>
  );
}
