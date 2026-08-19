'use client';

import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';

import {useToast} from '@/components/ui/toast';

interface MessageRow {
  id: string;
  trade_id: string | null;
  sender_address: string;
  body: string;
  created_at: string;
}

export interface TradeMessage {
  id: string;
  tradeId: string | null;
  sender: `0x${string}`;
  body: string;
  sentAt: string;
}

function toMessage(row: MessageRow): TradeMessage {
  return {
    id: row.id,
    tradeId: row.trade_id,
    sender: row.sender_address as `0x${string}`,
    body: row.body,
    sentAt: row.created_at,
  };
}

/**
 * Correspondence on a trade, persisted in Supabase.
 *
 * Polled rather than subscribed: the anon key is read-only by policy and a realtime channel would
 * need its own authorisation story. A short interval is enough for a thread that moves at the pace
 * of a shipping negotiation.
 */
export function useMessages(tradeId: string | null) {
  const queryClient = useQueryClient();
  const {push} = useToast();

  const query = useQuery({
    queryKey: ['messages', tradeId],
    enabled: tradeId !== null,
    refetchInterval: 15_000,
    queryFn: async () => {
      const response = await fetch(`/api/messages?tradeId=${tradeId}`);
      const payload = (await response.json()) as {messages?: MessageRow[]; error?: string};
      if (!response.ok) throw new Error(payload.error ?? 'Could not load messages.');
      return (payload.messages ?? []).map(toMessage);
    },
  });

  const send = useMutation({
    mutationFn: async (input: {tradeId: string; body: string}) => {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(input),
      });
      const payload = (await response.json()) as {message?: MessageRow; error?: string};
      if (!response.ok) throw new Error(payload.error ?? 'Could not send the message.');
      return payload.message ? toMessage(payload.message) : null;
    },
    onSuccess: (_, input) => {
      void queryClient.invalidateQueries({queryKey: ['messages', input.tradeId]});
    },
    onError: (error: Error) => {
      push({kind: 'error', title: 'Could not send message', description: error.message});
    },
  });

  return {
    messages: query.data ?? [],
    isLoading: query.isLoading,
    send: send.mutateAsync,
    isSending: send.isPending,
  };
}
