'use client';

import {useAccount} from 'wagmi';

import {Badge} from '@/components/ui/badge';
import {Card, CardBody, CardHeader} from '@/components/ui/card';
import {Copyable} from '@/components/ui/copyable';
import {Field, Select} from '@/components/ui/field';
import {cn} from '@/components/ui/cn';
import {useRole} from '@/hooks/use-role';
import {activeNetworkName, creditcoin, explorerAddressUrl, sourceChain} from '@/lib/config/chains';
import {
  attestationMode,
  isChainConfigured,
  isProofPipelineConfigured,
  isSupabaseConfigured,
  uscConfig,
} from '@/lib/config/env';
import {shortenAddress} from '@/lib/format';
import type {Role} from '@/types/trade';

const ROLE_DESCRIPTIONS: Record<Role, string> = {
  buyer: 'Import goods, post collateral and repay financing.',
  supplier: 'Ship goods against confirmed financing and receive disbursement.',
  financier: 'Provide working capital against collateralised trades.',
};

export default function SettingsPage() {
  const {address, isConnected} = useAccount();
  const {role, setRole} = useRole();

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Settings</h1>
        <p className="mt-1.5 text-[14px] text-ink-muted">
          Account, role and deployment configuration.
        </p>
      </header>

      <Card>
        <CardHeader
          title="Account"
          description="TImx authenticates with your wallet. There is no password to manage."
        />
        <CardBody className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13px] text-ink-subtle">Connected address</span>
            {isConnected && address ? (
              <Copyable
                value={address}
                display={shortenAddress(address)}
                href={explorerAddressUrl(creditcoin.id, address)}
              />
            ) : (
              <span className="text-[13px] text-ink-muted">Not connected</span>
            )}
          </div>

          <Field
            label="Active role"
            hint="A view preference. The contracts determine what you can actually do on each trade, based on your position in it."
          >
            <Select value={role} onChange={(event) => setRole(event.target.value as Role)}>
              <option value="buyer">Buyer</option>
              <option value="supplier">Supplier</option>
              <option value="financier">Financier</option>
            </Select>
          </Field>
          <p className="text-[12.5px] leading-relaxed text-ink-muted">
            {ROLE_DESCRIPTIONS[role]}
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Deployment"
          description="What this build is pointed at, and what it can prove."
        />
        <CardBody>
          <dl className="space-y-3 text-[13px]">
            <Row label="Creditcoin network" value={`${creditcoin.name} (${activeNetworkName})`} />
            <Row label="Creditcoin chain id" value={creditcoin.id.toString()} />
            <Row label="Source chain" value={`${sourceChain.name} (${sourceChain.id})`} />
            <Row
              label="Source chain key"
              value={String(uscConfig.sourceChainKey)}
              hint="Creditcoin's identifier for the source chain, not its EVM chain id"
            />
            <Row
              label="Attestation mode"
              value={attestationMode === 'usc' ? 'USC proving' : 'Demo assertion'}
            />
            <StatusRow label="Protocol contracts" ok={isChainConfigured} />
            <StatusRow label="Proof pipeline" ok={isProofPipelineConfigured} />
            <StatusRow label="Supabase metadata" ok={isSupabaseConfigured} />
          </dl>
        </CardBody>
      </Card>
    </div>
  );
}

function Row({label, value, hint}: {label: string; value: string; hint?: string}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <dt className="text-ink-subtle">{label}</dt>
        {hint ? <p className="mt-0.5 text-[12px] text-ink-subtle">{hint}</p> : null}
      </div>
      <dd className="numeric text-right font-medium text-ink">{value}</dd>
    </div>
  );
}

function StatusRow({label, ok}: {label: string; ok: boolean}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-ink-subtle">{label}</dt>
      <dd>
        <Badge tone={ok ? 'positive' : 'neutral'} className={cn(!ok && 'opacity-80')}>
          {ok ? 'Configured' : 'Not configured'}
        </Badge>
      </dd>
    </div>
  );
}
