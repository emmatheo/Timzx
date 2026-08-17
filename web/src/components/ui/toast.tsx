'use client';

import {createContext, useCallback, useContext, useMemo, useState, type ReactNode} from 'react';
import {AlertTriangle, CheckCircle2, Info, X, XCircle} from 'lucide-react';

import {cn} from './cn';

type ToastKind = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  description?: string;
  /** Optional link, used to point at a block explorer for a confirmed transaction. */
  href?: string;
  hrefLabel?: string;
}

interface ToastContextValue {
  push: (toast: Omit<Toast, 'id'>) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const icons = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
  warning: AlertTriangle,
} as const;

const tones: Record<ToastKind, string> = {
  success: 'border-positive/30 bg-positive-soft',
  error: 'border-danger/30 bg-danger-soft',
  info: 'border-info/30 bg-info-soft',
  warning: 'border-warning/30 bg-warning-soft',
};

const iconTones: Record<ToastKind, string> = {
  success: 'text-positive',
  error: 'text-danger',
  info: 'text-info',
  warning: 'text-warning',
};

export function ToastProvider({children}: {children: ReactNode}) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (toast: Omit<Toast, 'id'>) => {
      const id = Date.now() + Math.random();
      setToasts((current) => [...current, {...toast, id}]);
      // Errors stay until dismissed: a failed transaction is worth reading twice.
      if (toast.kind !== 'error') {
        setTimeout(() => dismiss(id), 6000);
      }
    },
    [dismiss],
  );

  const value = useMemo(() => ({push}), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6"
        role="status"
        aria-live="polite"
      >
        {toasts.map((toast) => {
          const Icon = icons[toast.kind];
          return (
            <div
              key={toast.id}
              className={cn(
                'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border px-4 py-3 backdrop-blur-sm',
                tones[toast.kind],
              )}
            >
              <Icon className={cn('mt-0.5 size-4 shrink-0', iconTones[toast.kind])} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-ink">{toast.title}</p>
                {toast.description ? (
                  <p className="mt-0.5 text-[12px] leading-relaxed break-words text-ink-muted">
                    {toast.description}
                  </p>
                ) : null}
                {toast.href ? (
                  <a
                    href={toast.href}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1.5 inline-block text-[12px] font-medium text-accent hover:underline"
                  >
                    {toast.hrefLabel ?? 'View transaction'}
                  </a>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                className="rounded p-0.5 text-ink-subtle transition-colors hover:text-ink"
                aria-label="Dismiss notification"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}
