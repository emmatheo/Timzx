import {cn} from '@/components/ui/cn';

/**
 * Wordmark. The glyph is an inline SVG rather than an icon-font character so it renders
 * identically everywhere and scales with the layout.
 */
export function Logo({className, compact = false}: {className?: string; compact?: boolean}) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <svg viewBox="0 0 28 28" className="size-7 shrink-0" role="img" aria-label="TImx">
        <defs>
          <linearGradient id="timx-mark" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--color-accent)" />
            <stop offset="100%" stopColor="var(--color-violet)" />
          </linearGradient>
        </defs>
        <rect width="28" height="28" rx="7" fill="url(#timx-mark)" />
        {/* Two arcs meeting at a verified point: the corridor and the proof that closes it. */}
        <path
          d="M7.5 18.5c2.6-6.4 10.4-6.4 13 0"
          fill="none"
          stroke="white"
          strokeOpacity="0.92"
          strokeWidth="1.9"
          strokeLinecap="round"
        />
        <circle cx="14" cy="10.4" r="2.2" fill="white" />
      </svg>
      {!compact ? (
        <span className="text-[15px] font-semibold tracking-tight text-ink">TImx</span>
      ) : null}
    </span>
  );
}
