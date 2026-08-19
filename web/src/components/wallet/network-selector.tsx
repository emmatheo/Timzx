'use client';

import {AlertTriangle, Check, Network} from 'lucide-react';
import {useAccount, useSwitchChain} from 'wagmi';

import {Button} from '@/components/ui/button';
import {creditcoin, sourceChain} from '@/lib/config/chains';

/**
 * Network indicator and switcher.
 *
 * TImx spans two chains by design, so this shows which one the wallet is on and offers to move it.
 * A wrong-network state is called out explicitly rather than letting writes fail at signing time.
 */
export function NetworkSelector() {
  const {chainId, isConnected} = useAccount();
  const {switchChain, isPending} = useSwitchChain();

  if (!isConnected) return null;

  const onCreditcoin = chainId === creditcoin.id;
  const onSource = chainId === sourceChain.id;
  const known = onCreditcoin || onSource;

  if (!known) {
    return (
      <Button
        variant="secondary"
        size="sm"
        icon={AlertTriangle}
        loading={isPending}
        onClick={() => switchChain({chainId: creditcoin.id})}
        className="border-warning/40 text-warning"
      >
        Wrong network
      </Button>
    );
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      icon={onCreditcoin ? Check : Network}
      loading={isPending}
      onClick={() => switchChain({chainId: onCreditcoin ? sourceChain.id : creditcoin.id})}
      title={onCreditcoin ? 'Switch to the source chain' : 'Switch to Creditcoin'}
    >
      <span className="hidden sm:inline">{onCreditcoin ? creditcoin.name : sourceChain.name}</span>
      <span className="sm:hidden">{onCreditcoin ? 'CTC' : 'SEP'}</span>
    </Button>
  );
}
