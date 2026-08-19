import type {ReactNode} from 'react';
import {Loader2, type LucideIcon} from 'lucide-react';

import {cn} from './cn';

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-14 text-center', className)}>
      <div className="mb-4 flex size-11 items-center justify-center rounded-xl border border-line bg-surface-overlay">
        <Icon className="size-5 text-ink-subtle" aria-hidden />
      </div>
      <p className="text-sm font-medium text-ink">{title}</p>
      {description ? (
        <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-ink-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function LoadingState({label = 'Loading', className}: {label?: string; className?: string}) {
  return (
    <div className={cn('flex items-center justify-center gap-2.5 px-6 py-14', className)}>
      <Loader2 className="size-4 animate-spin text-ink-subtle" aria-hidden />
      <span className="text-[13px] text-ink-muted">{label}</span>
    </div>
  );
}

/** Skeleton row for tables, so layout does not jump when data lands. */
export function SkeletonRows({rows = 4, className}: {rows?: number; className?: string}) {
  return (
    <div className={cn('space-y-2 p-4', className)}>
      {Array.from({length: rows}).map((_, index) => (
        <div key={index} className="h-11 animate-pulse rounded-lg bg-surface-overlay" />
      ))}
    </div>
  );
}
