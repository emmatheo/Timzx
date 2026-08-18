'use client';

import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {keccak256, toHex} from 'viem';

import {useToast} from '@/components/ui/toast';
import type {DocumentRecord} from '@/types/trade';

interface DocumentRow {
  id: string;
  trade_id: string;
  name: string;
  document_type: string;
  content_hash: string | null;
  storage_cid: string | null;
  uploaded_by: string | null;
  created_at: string;
}

function toRecord(row: DocumentRow): DocumentRecord {
  return {
    id: row.id,
    tradeId: row.trade_id,
    name: row.name,
    documentType: row.document_type,
    contentHash: (row.content_hash as `0x${string}` | null) ?? null,
    storageCid: row.storage_cid,
    uploadedBy: (row.uploaded_by as `0x${string}` | null) ?? null,
    uploadedAt: row.created_at,
    anchored: row.content_hash !== null,
  };
}

/** Hashes a file in the browser. The bytes never leave the device. */
export async function hashFile(file: File): Promise<`0x${string}`> {
  const buffer = await file.arrayBuffer();
  return keccak256(toHex(new Uint8Array(buffer)));
}

/** Documents registered against a trade, persisted in Supabase. */
export function useDocuments(tradeId: string | null) {
  const queryClient = useQueryClient();
  const {push} = useToast();

  const query = useQuery({
    queryKey: ['documents', tradeId],
    enabled: tradeId !== null,
    queryFn: async () => {
      const response = await fetch(`/api/documents?tradeId=${tradeId}`);
      const payload = (await response.json()) as {documents?: DocumentRow[]; error?: string};
      if (!response.ok) throw new Error(payload.error ?? 'Could not load documents.');
      return (payload.documents ?? []).map(toRecord);
    },
  });

  const register = useMutation({
    mutationFn: async (input: {
      tradeId: string;
      name: string;
      documentType: string;
      contentHash: `0x${string}`;
    }) => {
      const response = await fetch('/api/documents', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(input),
      });
      const payload = (await response.json()) as {document?: DocumentRow; error?: string};
      if (!response.ok) throw new Error(payload.error ?? 'Could not register the document.');
      return payload.document ? toRecord(payload.document) : null;
    },
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
    isLoading: query.isLoading,
    register: register.mutateAsync,
    isRegistering: register.isPending,
  };
}
