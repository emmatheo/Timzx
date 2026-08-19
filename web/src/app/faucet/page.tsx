'use client';

import {useEffect, useState} from 'react';
import {AlertTriangle, Coins, Droplets, Fuel} from 'lucide-react';
import {useAccount} from 'wagmi';

import {Badge} from '@/components/ui/badge';
import {Button} from '@/components/ui/button';
import {Card, CardBody, CardHeader} from '@/components/ui/card';
import {Copyable} from '@/components/ui/copyable';
import {useFaucet} from '@/hooks/use-faucet';
import {useSettlementToken} from '@/hooks/use-protocol';
import {creditcoin, explorerAddressUrl} from '@/lib/config/chains';
import {contractAddresses} from '@/lib/config/env';
import {formatDateTime, formatDuration, formatMoney, formatTokenAmount, shortenAddress} from '@/lib/format';

/**
 * Testnet faucet.
 *
 * Cooldown and balance come from the contract, and the request is a real transaction — there is no
 * simulated success state. A failed request shows the failure.
 */
export default function FaucetPage() {
  const {address, isConnected} = useAccount();
  const faucet = useFaucet();
  const token = useSettlementToken();
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));

  // The cooldown is a live countdown, so it ticks rather than going stale until a refetch.
  useEffect(() => {
    const timer = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(timer);
  }, []);

  const secondsRemaining = faucet.availableAt > now ? faucet.availableAt - now : 0;
  const onCooldown = secondsRemaining > 0;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            Creditcoin Testnet Faucet
          </h1>
          <p className="mt-1.5 text-[14px] text-ink-muted">
            Get testnet assets to interact with TImx.
          </p>
        </div>
        <Badge tone="warning" icon={AlertTriangle}>
          Testnet only
        </Badge>
      </header>

      <div className="rounded-lg border border-warning/30 bg-warning-soft px-4 py-3">
        <p className="text-[13px] leading-relaxed text-ink-muted">
          These assets exist only on {creditcoin.name}. They have no value, cannot be exchanged, and
          are issued solely so you can exercise the trade lifecycle.
        </p>
      </div>

      <Card>
        <CardHeader
          title="Connected wallet"
          description="Assets are sent to the address that signs the request."
        />
        <CardBody>
          {isConnected && address ? (
            <Copyable
              value={address}
              display={shortenAddress(address, 4)}
              href={explorerAddressUrl(creditcoin.id, address)}
            />
          ) : (
            <p className="text-[13px] text-ink-muted">
              Connect a wallet to request testnet assets.
            </p>
          )}
        </CardBody>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardBody>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl border border-accent/25 bg-accent-soft">
                  <Coins className="size-5 text-accent" aria-hidden />
                </span>
                <div>
                  <p className="text-[15px] font-semibold text-ink">{token.symbol}</p>
                  <p className="text-[12.5px] text-ink-subtle">Testnet settlement stablecoin</p>
                </div>
              </div>
              <Badge tone="neutral">ERC-20</Badge>
            </div>

            <dl className="mt-5 space-y-2.5 text-[13px]">
              <Row label="Your balance" value={formatMoney(token.balance, {precise: true})} />
              <Row label="Request amount" value={formatMoney(faucet.dripAmount)} />
              <Row
                label="Cooldown"
                value={
                  faucet.cooldownSeconds > 0
                    ? `${Math.round(faucet.cooldownSeconds / 3600)} hours`
                    : '—'
                }
              />
              <Row
                label="Last request"
                value={faucet.lastRequestAt > 0 ? formatDateTime(faucet.lastRequestAt) : 'Never'}
              />
              <Row label="Faucet reserve" value={formatMoney(faucet.faucetBalance)} />
            </dl>

            <Button
              className="mt-5 w-full"
              icon={Droplets}
              loading={faucet.pending}
              disabled={!isConnected || !faucet.configured || onCooldown}
              onClick={() => void faucet.request()}
            >
              {onCooldown
                ? `Available in ${formatDuration(secondsRemaining)}`
                : `Request ${formatMoney(faucet.dripAmount)}`}
            </Button>

            {!faucet.configured ? (
              <p className="mt-2.5 text-[12px] leading-relaxed text-ink-subtle">
                Faucet contract is not configured for this deployment. Set
                NEXT_PUBLIC_FAUCET_ADDRESS after running the deploy script.
              </p>
            ) : null}
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl border border-line-strong bg-surface-overlay">
                  <Fuel className="size-5 text-ink-muted" aria-hidden />
                </span>
                <div>
                  <p className="text-[15px] font-semibold text-ink">{faucet.nativeSymbol}</p>
                  <p className="text-[12.5px] text-ink-subtle">Native gas token</p>
                </div>
              </div>
              <Badge tone="neutral">Native</Badge>
            </div>

            <dl className="mt-5 space-y-2.5 text-[13px]">
              <Row
                label="Your balance"
                value={formatTokenAmount(faucet.nativeBalance, 18, faucet.nativeSymbol)}
              />
              <Row label="Source" value="Creditcoin public faucet" />
            </dl>

            <p className="mt-5 text-[12.5px] leading-relaxed text-ink-muted">
              Gas is not dispensed by this contract. TImx does not custody native CTC, so requesting
              it goes through the official Creditcoin testnet faucet rather than through a
              contract we control.
            </p>
            <a
              href="https://docs.creditcoin.org"
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-block text-[13px] font-medium text-accent hover:underline"
            >
              Creditcoin testnet documentation
            </a>
          </CardBody>
        </Card>
      </div>

      {contractAddresses.faucet ? (
        <p className="text-[12px] text-ink-subtle">
          Faucet contract:{' '}
          <Copyable
            value={contractAddresses.faucet}
            display={shortenAddress(contractAddresses.faucet)}
            href={explorerAddressUrl(creditcoin.id, contractAddresses.faucet)}
          />
        </p>
      ) : null}
    </div>
  );
}

function Row({label, value}: {label: string; value: string}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-ink-subtle">{label}</dt>
      <dd className="numeric font-medium text-ink">{value}</dd>
    </div>
  );
}
