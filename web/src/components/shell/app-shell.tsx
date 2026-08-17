'use client';

import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useEffect, useState, type ReactNode} from 'react';
import {Bell, Menu, PanelLeftClose, X} from 'lucide-react';

import {Logo} from './logo';
import {navItems} from './nav-items';
import {NetworkSelector} from '@/components/wallet/network-selector';
import {WalletButton} from '@/components/wallet/wallet-button';
import {DeploymentBanner} from '@/components/ui/data-mode';
import {cn} from '@/components/ui/cn';
import {useRole} from '@/hooks/use-role';

/**
 * Application frame.
 *
 * Desktop keeps a persistent sidebar; tablet collapses it to icons; mobile moves primary
 * destinations into a bottom bar and the rest into a drawer. The mobile layout is a different
 * arrangement rather than a scaled-down desktop one, because a shrunken sidebar is unusable at
 * thumb reach.
 */
export function AppShell({children}: {children: ReactNode}) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const {role} = useRole();

  // Navigating should always close the drawer, including via back/forward.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <div className="min-h-dvh bg-canvas">
      {/* Sidebar: desktop and tablet */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-line bg-surface transition-[width] lg:flex',
          collapsed ? 'w-[68px]' : 'w-[248px]',
        )}
      >
        <div className="flex h-16 items-center justify-between px-4">
          <Link href="/" aria-label="TImx home">
            <Logo compact={collapsed} />
          </Link>
          {!collapsed ? (
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              className="rounded-lg p-1.5 text-ink-subtle transition-colors hover:bg-surface-hover hover:text-ink"
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose className="size-4" aria-hidden />
            </button>
          ) : null}
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors',
                  active
                    ? 'bg-accent-soft text-ink'
                    : 'text-ink-muted hover:bg-surface-hover hover:text-ink',
                  collapsed && 'justify-center px-0',
                )}
              >
                <item.icon
                  className={cn('size-[18px] shrink-0', active ? 'text-accent' : '')}
                  aria-hidden
                />
                {!collapsed ? <span className="truncate">{item.label}</span> : null}
              </Link>
            );
          })}
        </nav>

        {collapsed ? (
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className="m-3 rounded-lg p-2 text-ink-subtle transition-colors hover:bg-surface-hover hover:text-ink"
            aria-label="Expand sidebar"
          >
            <Menu className="mx-auto size-4" aria-hidden />
          </button>
        ) : (
          <div className="m-3 rounded-lg border border-line bg-surface-overlay px-3 py-2.5">
            <p className="text-[11px] font-medium tracking-wide text-ink-subtle uppercase">
              Active role
            </p>
            <p className="mt-0.5 text-[13px] font-medium text-ink capitalize">{role}</p>
          </div>
        )}
      </aside>

      {/* Mobile drawer */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => setDrawerOpen(false)}
            aria-hidden
          />
          <div className="absolute inset-y-0 left-0 flex w-[268px] flex-col border-r border-line bg-surface">
            <div className="flex h-16 items-center justify-between px-4">
              <Logo />
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="rounded-lg p-1.5 text-ink-subtle hover:bg-surface-hover hover:text-ink"
                aria-label="Close navigation"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
            <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive(item.href)
                      ? 'bg-accent-soft text-ink'
                      : 'text-ink-muted hover:bg-surface-hover hover:text-ink',
                  )}
                >
                  <item.icon className="size-[18px] shrink-0" aria-hidden />
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      ) : null}

      <div className={cn('transition-[padding]', collapsed ? 'lg:pl-[68px]' : 'lg:pl-[248px]')}>
        <header className="sticky top-0 z-20 border-b border-line bg-canvas/85 backdrop-blur-md">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="size-5" aria-hidden />
            </button>
            <Link href="/" className="lg:hidden" aria-label="TImx home">
              <Logo compact />
            </Link>

            <div className="ml-auto flex items-center gap-2">
              <NetworkSelector />
              <Link
                href="/messages"
                className="relative rounded-lg p-2 text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink"
                aria-label="Notifications"
              >
                <Bell className="size-[18px]" aria-hidden />
              </Link>
              <WalletButton />
            </div>
          </div>
        </header>

        <main className="px-4 pt-5 pb-24 sm:px-6 lg:pb-10">
          <DeploymentBanner className="mb-5" />
          {children}
        </main>
      </div>

      {/* Mobile bottom bar */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur-md lg:hidden">
        <div className="grid grid-cols-4">
          {navItems
            .filter((item) => item.primary)
            .map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors',
                    active ? 'text-accent' : 'text-ink-subtle',
                  )}
                >
                  <item.icon className="size-[18px]" aria-hidden />
                  {item.label}
                </Link>
              );
            })}
        </div>
      </nav>
    </div>
  );
}
