/** Display formatting. Presentation only — never feed these results back into arithmetic. */
import {formatUnits} from 'viem';

import {SETTLEMENT_DECIMALS} from '@/lib/finance';

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const usdPrecise = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compact = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

/** Settlement-token units to a dollar string. Whole dollars by default: cents are noise on a
 *  $50,000 trade and only obscure the column alignment. */
export function formatMoney(value: bigint, opts: {precise?: boolean} = {}): string {
  const asNumber = Number(formatUnits(value, SETTLEMENT_DECIMALS));
  return opts.precise ? usdPrecise.format(asNumber) : usd.format(asNumber);
}

/** For stat tiles, where the magnitude matters more than the exact figure. */
export function formatMoneyCompact(value: bigint): string {
  const asNumber = Number(formatUnits(value, SETTLEMENT_DECIMALS));
  return `$${compact.format(asNumber)}`;
}

export function formatTokenAmount(value: bigint, decimals: number, symbol: string): string {
  const asNumber = Number(formatUnits(value, decimals));
  return `${asNumber.toLocaleString('en-US', {maximumFractionDigits: 4})} ${symbol}`;
}

export function formatPercent(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`;
}

/** Shortens an address for display. Full values stay available via copy and explorer links. */
export function shortenAddress(address: string | null | undefined, chars = 4): string {
  if (!address) return '—';
  if (address.length <= chars * 2 + 2) return address;
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

export function shortenHash(hash: string | null | undefined): string {
  if (!hash) return '—';
  if (hash === `0x${'0'.repeat(64)}`) return '—';
  return `${hash.slice(0, 10)}...${hash.slice(-6)}`;
}

export function formatDate(input: Date | number | string | null): string {
  if (input === null) return '—';
  const date =
    typeof input === 'number' ? new Date(input * 1000) : input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', {day: 'numeric', month: 'short', year: 'numeric'});
}

export function formatDateTime(input: Date | number | null): string {
  if (input === null) return '—';
  const date = typeof input === 'number' ? new Date(input * 1000) : input;
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Relative time, for activity feeds where "when" matters more than the exact clock. */
export function formatRelative(timestampSeconds: number, now = Date.now()): string {
  if (timestampSeconds === 0) return '—';
  const deltaSeconds = Math.round((timestampSeconds * 1000 - now) / 1000);
  const abs = Math.abs(deltaSeconds);
  const rtf = new Intl.RelativeTimeFormat('en', {numeric: 'auto'});

  if (abs < 60) return rtf.format(Math.round(deltaSeconds), 'second');
  if (abs < 3600) return rtf.format(Math.round(deltaSeconds / 60), 'minute');
  if (abs < 86_400) return rtf.format(Math.round(deltaSeconds / 3600), 'hour');
  return rtf.format(Math.round(deltaSeconds / 86_400), 'day');
}

/** Countdown for the faucet cooldown. */
export function formatDuration(seconds: number): string {
  if (seconds <= 0) return 'Available now';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

/** Parses a user-entered dollar amount into settlement-token units. */
export function parseMoneyInput(input: string): bigint | null {
  const cleaned = input.replace(/[$,\s]/g, '');
  if (cleaned === '' || !/^\d*\.?\d*$/.test(cleaned)) return null;
  const [whole = '0', fraction = ''] = cleaned.split('.');
  const paddedFraction = fraction.padEnd(SETTLEMENT_DECIMALS, '0').slice(0, SETTLEMENT_DECIMALS);
  try {
    return BigInt(whole || '0') * 10n ** BigInt(SETTLEMENT_DECIMALS) + BigInt(paddedFraction || '0');
  } catch {
    return null;
  }
}
