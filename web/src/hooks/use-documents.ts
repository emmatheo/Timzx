'use client';

import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {useMemo} from 'react';

import {useToast} from '@/components/ui/toast';
import {DocumentService, type RegisterDocumentInput} from '@/lib/services';

/** Hashes a file in the browser. Re-exported so callers need not reach into the service. */
export const hashFile = DocumentService.hash;

/** Documents registered against a trade, persisted through the authenticated route handler. */
export function useDocuments(tradeId: string | null) {
  const queryClient = useQueryClient();
  const {push} = useToast();
  const service = useMemo(() => new DocumentService(), []);

  const query = useQuery({
    queryKey: ['documents', tradeId],
    enabled: tradeId !== null,
    queryFn: () => service.list(tradeId as string),
  });

  const register = useMutation({
    mutationFn: (input: RegisterDocumentInput) => service.register(input),
    onSuccess: (_, input) => {
      void queryClient.invalidateQueries({queryKey: ['documents', input.tradeId]});
      push({kind: 'success', title: 'Document registered'});
    },
    onError: (error: Error) => {
      push({kind: 'error', title: 'Could not register document', description: error.message});
    },
  });

  return {
    documents: query.data ?? [],
    isLoading: tradeId === null ? false : query.isLoading,
    register: register.mutateAsync,
    isRegistering: register.isPending,
  };
}
