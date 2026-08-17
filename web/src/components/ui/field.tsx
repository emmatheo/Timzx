import type {InputHTMLAttributes, ReactNode, SelectHTMLAttributes} from 'react';

import {cn} from './cn';

const control =
  'h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink placeholder:text-ink-subtle transition-colors focus:border-accent focus:outline-none disabled:opacity-60';

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1.5 block text-[13px] font-medium text-ink-muted">{label}</span>
      {children}
      {error ? (
        <span className="mt-1.5 block text-[12px] text-danger">{error}</span>
      ) : hint ? (
        <span className="mt-1.5 block text-[12px] leading-relaxed text-ink-subtle">{hint}</span>
      ) : null}
    </label>
  );
}

export function TextInput({className, ...rest}: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={cn(control, className)} />;
}

export function Select({
  className,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & {children: ReactNode}) {
  return (
    <select {...rest} className={cn(control, 'pr-8', className)}>
      {children}
    </select>
  );
}

/** Label/value pair used throughout detail panels. */
export function DataPoint({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <dt className="text-[12px] font-medium tracking-wide text-ink-subtle uppercase">{label}</dt>
      <dd className="numeric mt-1 truncate text-[15px] font-semibold text-ink">{value}</dd>
      {hint ? <p className="mt-0.5 text-[12px] text-ink-subtle">{hint}</p> : null}
    </div>
  );
}
