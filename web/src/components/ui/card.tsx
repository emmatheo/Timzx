import type {ReactNode} from 'react';

import {cn} from './cn';

/**
 * The single container primitive.
 *
 * Cards do not nest. A section that needs internal grouping uses `CardSection` dividers instead,
 * which keeps the elevation ramp one level deep and avoids the stacked-box look that makes
 * dashboards feel cluttered.
 */
export function Card({
  children,
  className,
  as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'article';
}) {
  return (
    <Tag
      className={cn(
        'rounded-[14px] border border-line bg-surface-raised shadow-[0_1px_2px_rgba(0,0,0,0.28)]',
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4',
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h2>
        {description ? (
          <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function CardBody({children, className}: {children: ReactNode; className?: string}) {
  return <div className={cn('px-5 py-4', className)}>{children}</div>;
}

export function CardSection({children, className}: {children: ReactNode; className?: string}) {
  return <div className={cn('border-t border-line px-5 py-4 first:border-t-0', className)}>{children}</div>;
}
