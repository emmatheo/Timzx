'use client';

import {useState} from 'react';
import {MessagesSquare, Send} from 'lucide-react';
import {useAccount} from 'wagmi';

import {Button} from '@/components/ui/button';
import {Card, CardBody, CardHeader} from '@/components/ui/card';
import {Field, Select, TextInput} from '@/components/ui/field';
import {EmptyState} from '@/components/ui/states';
import {useMyTrades} from '@/hooks/use-protocol';
import {useTradeViews} from '@/hooks/use-trade-views';
import {formatRelative, shortenAddress} from '@/lib/format';

interface LocalMessage {
  id: string;
  tradeId: string;
  sender: string;
  body: string;
  sentAt: number;
}

/**
 * Trade messaging.
 *
 * Counterparty correspondence attached to a trade. Messages are off-chain by design — commercial
 * discussion does not belong in consensus, and nothing here affects protocol state.
 *
 * Held in session state in this build; the `messages` table and a Supabase realtime channel
 * replace the state hook without changing the component.
 */
export default function MessagesPage() {
  const {address, isConnected} = useAccount();
  const {trades: entries} = useMyTrades();
  const views = useTradeViews(entries);
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [tradeId, setTradeId] = useState('');
  const [draft, setDraft] = useState('');

  const send = () => {
    if (!draft.trim() || !tradeId || !address) return;
    setMessages((current) => [
      ...current,
      {id: `${Date.now()}`, tradeId, sender: address, body: draft.trim(), sentAt: Date.now()},
    ]);
    setDraft('');
  };

  const thread = messages.filter((message) => message.tradeId === tradeId);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Messages</h1>
        <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-ink-muted">
          Counterparty correspondence attached to a trade. Off-chain by design — nothing sent here
          affects protocol state.
        </p>
      </header>

      <Card>
        <CardHeader title="Trade thread" />
        <CardBody className="space-y-4">
          <Field label="Trade">
            <Select value={tradeId} onChange={(event) => setTradeId(event.target.value)}>
              <option value="">Select a trade</option>
              {views.map(({chain, meta}) => (
                <option key={chain.id.toString()} value={chain.id.toString()}>
                  {meta?.title ?? `Trade #${chain.id}`}
                </option>
              ))}
            </Select>
          </Field>

          {!tradeId ? (
            <EmptyState
              icon={MessagesSquare}
              title="Select a trade"
              description="Choose a trade to open its correspondence thread."
            />
          ) : thread.length === 0 ? (
            <EmptyState
              icon={MessagesSquare}
              title="No messages yet"
              description="Start the conversation with your counterparty."
            />
          ) : (
            <ul className="space-y-3">
              {thread.map((message) => {
                const mine = message.sender.toLowerCase() === address?.toLowerCase();
                return (
                  <li
                    key={message.id}
                    className={mine ? 'flex justify-end' : 'flex justify-start'}
                  >
                    <div
                      className={
                        mine
                          ? 'max-w-[80%] rounded-xl rounded-br-sm border border-accent/30 bg-accent-soft px-3.5 py-2.5'
                          : 'max-w-[80%] rounded-xl rounded-bl-sm border border-line bg-surface-overlay px-3.5 py-2.5'
                      }
                    >
                      <p className="text-[13.5px] leading-relaxed break-words text-ink">
                        {message.body}
                      </p>
                      <p className="mt-1 text-[11.5px] text-ink-subtle">
                        {shortenAddress(message.sender)} ·{' '}
                        {formatRelative(Math.floor(message.sentAt / 1000))}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="flex gap-2">
            <TextInput
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') send();
              }}
              placeholder={isConnected ? 'Write a message' : 'Connect a wallet to send messages'}
              disabled={!isConnected || !tradeId}
            />
            <Button icon={Send} onClick={send} disabled={!isConnected || !tradeId || !draft.trim()}>
              Send
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
