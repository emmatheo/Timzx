'use client';

import type {ButtonHTMLAttributes, ReactNode} from 'react';
import Link from 'next/link';
import {Loader2, type LucideIcon} from 'lucide-react';

import {cn} from './cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-white hover:bg-accent-hover disabled:bg-accent/40',
  secondary:
    'border border-line-strong bg-surface-overlay text-ink hover:bg-surface-hover disabled:text-ink-subtle',
  ghost: 'text-ink-muted hover:bg-surface-hover hover:text-ink',
  danger: 'bg-danger text-white hover:bg-danger/90',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-11 px-5 text-sm gap-2',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  loading?: boolean;
  children?: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconRight: IconRight,
  loading = false,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-medium transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-70',
        variants[variant],
        sizes[size],
        className,
      )}
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : Icon ? (
        <Icon className="size-4" aria-hidden />
      ) : null}
      {children}
      {IconRight && !loading ? <IconRight className="size-4" aria-hidden /> : null}
    </button>
  );
}

/**
 * Anchor styled as a button.
 *
 * Separate component rather than an `asChild` prop on {@link Button}: nesting a link inside a
 * button is invalid HTML and breaks keyboard and screen-reader behaviour, so navigation and
 * actions get different elements.
 */
export function ButtonLink({
  href,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconRight: IconRight,
  className,
  children,
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-medium transition-colors',
        variants[variant],
        sizes[size],
        className,
      )}
    >
      {Icon ? <Icon className="size-4" aria-hidden /> : null}
      {children}
      {IconRight ? <IconRight className="size-4" aria-hidden /> : null}
    </Link>
  );
}
