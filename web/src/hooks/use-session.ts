'use client';

import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {useCallback} from 'react';
import {useAccount, useSignMessage} from 'wagmi';

import {useToast} from '@/components/ui/toast';
import {signInMessage} from '@/lib/sign-in-message';

async function json<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {...init, headers: {'Content-Type': 'application/json', ...init?.headers}});
  const payload = (await response.json().catch(() => ({}))) as T & {error?: string};
  if (!response.ok) throw new Error(payload.error ?? `Request failed (${response.status})`);
  return payload;
}

/**
 * Wallet-backed session.
 *
 * Connecting a wallet proves nothing to the server — the browser can claim any address. Signing a
 * server-issued nonce does, and that is what unlocks writes. Reads stay open, so the product is
 * fully browsable before anyone signs anything.
 */
export function useSession() {
  const {address} = useAccount();
  const {signMessageAsync} = useSignMessage();
  const queryClient = useQueryClient();
  const {push} = useToast();

  const session = useQuery({
    queryKey: ['session'],
    queryFn: () => json<{address: string | null}>('/api/auth/session'),
    staleTime: 60_000,
  });

  const signIn = useMutation({
    mutationFn: async () => {
      if (!address) throw new Error('Connect a wallet first.');
      const {nonce} = await json<{nonce: string}>('/api/auth/nonce', {
        method: 'POST',
        body: JSON.stringify({address}),
      });
      const signature = await signMessageAsync({message: signInMessage(address, nonce)});
      return json<{address: string}>('/api/auth/verify', {
        method: 'POST',
        body: JSON.stringify({address, signature}),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({queryKey: ['session']});
      push({kind: 'success', title: 'Signed in'});
    },
    onError: (error: Error) => {
      push({kind: 'error', title: 'Sign-in failed', description: error.message});
    },
  });

  const signOut = useMutation({
    mutationFn: () => json<{address: null}>('/api/auth/session', {method: 'DELETE'}),
    onSuccess: () => void queryClient.invalidateQueries({queryKey: ['session']}),
  });

  const sessionAddress = session.data?.address ?? null;

  // A session for a different wallet is not this wallet's session. Treat it as signed out so the
  // UI never implies the connected account is authorised when it is not.
  const authenticated = Boolean(
    sessionAddress && address && sessionAddress.toLowerCase() === address.toLowerCase(),
  );

  return {
    sessionAddress,
    authenticated,
    isLoading: session.isLoading,
    signIn: useCallback(() => signIn.mutate(), [signIn]),
    signOut: useCallback(() => signOut.mutate(), [signOut]),
    isSigningIn: signIn.isPending,
  };
}
