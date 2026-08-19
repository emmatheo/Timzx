'use client';

import {useState} from 'react';
import {Check, Copy, ExternalLink} from 'lucide-react';

import {cn} from './cn';

/** Truncated hash or address with copy and optional explorer link. */
export function Copyable({
  value,
  display,
  href,
  className,
}: {
  value: string;
  display: string;
  href?: string | null;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <span className="numeric font-mono text-[13px] text-ink-muted">{display}</span>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(value).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          });
        }}
        className="rounded p-0.5 text-ink-subtle transition-colors hover:text-ink"
        aria-label={copied ? 'Copied' : `Copy ${value}`}
      >
        {copied ? (
          <Check className="size-3.5 text-positive" aria-hidden />
        ) : (
          <Copy className="size-3.5" aria-hidden />
        )}
      </button>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="rounded p-0.5 text-ink-subtle transition-colors hover:text-ink"
          aria-label="Open in block explorer"
        >
          <ExternalLink className="size-3.5" aria-hidden />
        </a>
      ) : null}
    </span>
  );
}
