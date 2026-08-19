'use client';

import {Radio} from 'lucide-react';

import {Badge} from './badge';
import {cn} from './cn';
import {isChainConfigured} from '@/lib/config/env';
import {activeNetworkName, creditcoin} from '@/lib/config/chains';

/**
 * Provenance labelling.
 *
 * Every figure in the product is read from a chain, so there is one origin and one badge. This
 * exists so a reader never has to wonder where a number came from — not to distinguish real data
 * from anything else, because there is nothing else.
 */
export function OnChainBadge({className}: {className?: string}) {
  return (
    <Badge tone="info" icon={Radio} className={className}>
      On-chain
    </Badge>
  );
}

/**
 * Network banner.
 *
 * Names the network being read and says plainly when the protocol is not deployed on it, so an
 * empty dashboard is never mistaken for a dashboard with nothing in it.
 */
export function NetworkBanner({className}: {className?: string}) {
  if (isChainConfigured) return null;

  return (
    <div
      className={cn(
        'rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-[13px] leading-relaxed text-ink-muted',
        className,
      )}
    >
      <span className="font-medium text-ink">Protocol not deployed on {creditcoin.name}.</span>{' '}
      Run the Foundry deploy script and set the contract addresses in <code>.env.local</code>.
      Until then every view reads empty because there is nothing on-chain to read.
      <span className="ml-1 text-ink-subtle">Network: {activeNetworkName}</span>
    </div>
  );
}
