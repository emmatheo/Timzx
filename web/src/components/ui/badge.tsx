import type {ReactNode} from 'react';
import type {LucideIcon} from 'lucide-react';

import {cn} from './cn';
import type {Tone} from '@/lib/trade-state';

const tones: Record<Tone, string> = {
  neutral: 'bg-surface-overlay text-ink-muted border-line-strong',
  accent: 'bg-accent-soft text-accent border-accent/30',
  positive: 'bg-positive-soft text-positive border-positive/30',
  warning: 'bg-warning-soft text-warning border-warning/30',
  danger: 'bg-danger-soft text-danger border-danger/30',
  info: 'bg-info-soft text-info border-info/30',
};

/** Status pill. Always icon plus text — colour alone never carries the meaning. */
export function Badge({
  tone = 'neutral',
  icon: Icon,
  children,
  className,
}: {
  tone?: Tone;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[12px] font-medium whitespace-nowrap',
        tones[tone],
        className,
      )}
    >
      {Icon ? <Icon className="size-3.5 shrink-0" aria-hidden /> : null}
      {children}
    </span>
  );
}
