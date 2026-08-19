'use client';

import {useState} from 'react';
import {ChevronDown, LogOut, Wallet} from 'lucide-react';
import {useAccount, useConnect, useDisconnect} from 'wagmi';

import {Button} from '@/components/ui/button';
import {Modal} from '@/components/ui/modal';
import {shortenAddress} from '@/lib/format';

/**
 * Wallet connection.
 *
 * Shows the real connection state from wagmi. Every action in this product is a transaction
 * signed by a real key; there is no simulated wallet.
 */
export function WalletButton() {
  const {address, isConnected} = useAccount();
  const {connectors, connect, isPending} = useConnect();
  const {disconnect} = useDisconnect();
  const [open, setOpen] = useState(false);

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="hidden items-center gap-2 rounded-lg border border-line-strong bg-surface-overlay px-3 py-2 text-[13px] sm:inline-flex">
          <span className="size-1.5 rounded-full bg-positive" aria-hidden />
          <span className="numeric font-mono text-ink">{shortenAddress(address)}</span>
        </span>
        <Button
          variant="ghost"
          size="sm"
          icon={LogOut}
          onClick={() => disconnect()}
          aria-label="Disconnect wallet"
        />
      </div>
    );
  }

  return (
    <>
      <Button size="sm" icon={Wallet} iconRight={ChevronDown} onClick={() => setOpen(true)}>
        Connect
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Connect wallet"
        description="TImx uses your wallet for identity and for signing trade transactions on Creditcoin."
      >
        <div className="space-y-2">
          {connectors.length === 0 ? (
            <p className="text-[13px] leading-relaxed text-ink-muted">
              No injected wallet detected. Install a browser wallet such as MetaMask and reload.
            </p>
          ) : (
            connectors.map((connector) => (
              <button
                key={connector.uid}
                type="button"
                onClick={() => {
                  connect({connector});
                  setOpen(false);
                }}
                disabled={isPending}
                className="flex w-full items-center justify-between rounded-lg border border-line-strong bg-surface px-4 py-3 text-left transition-colors hover:bg-surface-hover disabled:opacity-60"
              >
                <span className="text-sm font-medium text-ink">{connector.name}</span>
                <Wallet className="size-4 text-ink-subtle" aria-hidden />
              </button>
            ))
          )}
        </div>
      </Modal>
    </>
  );
}
