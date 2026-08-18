'use client';

import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {useState, type ReactNode} from 'react';
import {WagmiProvider} from 'wagmi';

import {ToastProvider} from '@/components/ui/toast';
import {wagmiConfig} from '@/lib/wagmi';

export function Providers({children}: {children: ReactNode}) {
  // One client per browser session. Created in state so a re-render never swaps the cache out
  // from under in-flight queries.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Chain reads are cheap and a trade can advance while someone is looking at it, so a
            // short stale window keeps the UI honest without hammering the RPC.
            staleTime: 10_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>{children}</ToastProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
