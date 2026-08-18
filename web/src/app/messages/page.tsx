'use client';

import {useState} from 'react';
import {MessagesSquare, Send} from 'lucide-react';
import {useAccount} from 'wagmi';

import {Button} from '@/components/ui/button';
import {Card, CardBody, CardHeader} from '@/components/ui/card';
import {Field, Select, TextInput} from '@/components/ui/field';
import {EmptyState, LoadingState} from '@/components/ui/states';
import {useMessages} from '@/hooks/use-messages';
import {useMyTrades} from '@/hooks/use-protocol';
import {useSession} from '@/hooks/use-session';
import {useTradeViews} from '@/hooks/use-trade-views';
import {formatRelative, shortenAddress} from '@/lib/format';

/**
 * Trade messaging.
 *
 * Correspondence attached to a trade, persisted in Supabase. Off-chain by design — commercial
 * discussion does not belong in consensus — but the sender is established by a wallet signature,
 * so a message cannot be posted under someone else's address.
 */
export default function MessagesPage() {
  const {address} = useAccount();
  const {trades: entries} = useMyTrades();
  const views = useTradeViews(entries);
  const [tradeId, setTradeId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const {messages, isLoading, send, isSending} = useMessages(tradeId);
  const {authenticated, signIn, isSigningIn} = useSession();

  const submit = async () => {
    if (!draft.trim() || !tradeId) return;
    await send({tradeId, body: draft.trim()});
    setDraft('');
  };

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Messages</h1>
        <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-ink-muted">
          Counterparty correspondence attached to a trade. Nothing sent here affects protocol
          state.
        </p>
      </header>

      <Card>
        <CardHeader
          title="Trade thread"
          action={
            <Select
              value={tradeId ?? ''}
              onChange={(event) => setTradeId(event.target.value || null)}
              className="h-8 w-auto text-[13px]"
            >
              <option value="">Select a trade</option>
              {views.map(({chain, meta}) => (
                <option key={chain.id.toString()} value={chain.id.toString()}>
                  {meta?.title ?? `Trade #${chain.id}`}
                </option>
              ))}
            </Select>
          }
        />
        <CardBody className="space-y-4">
          {tradeId === null ? (
            <EmptyState
              icon={MessagesSquare}
              title="Select a trade"
              description="Choose a trade to open its correspondence thread."
            />
          ) : isLoading ? (
            <LoadingState label="Loading thread" />
          ) : messages.length === 0 ? (
            <EmptyState
              icon={MessagesSquare}
              title="No messages yet"
              description="Start the conversation with your counterparty."
            />
          ) : (
            <ul className="space-y-3">
              {messages.map((message) => {
                const mine = message.sender.toLowerCase() === address?.toLowerCase();
                return (
                  <li key={message.id} className={mine ? 'flex justify-end' : 'flex justify-start'}>
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
                        {formatRelative(Math.floor(new Date(message.sentAt).getTime() / 1000))}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {tradeId !== null ? (
            authenticated ? (
              <div className="flex gap-2">
                <TextInput
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void submit();
                  }}
                  placeholder="Write a message"
                  disabled={isSending}
                />
                <Button
                  icon={Send}
                  loading={isSending}
                  onClick={() => void submit()}
                  disabled={!draft.trim()}
                >
                  Send
                </Button>
              </div>
            ) : (
              <Field
                label="Sign in to reply"
                hint="Posting requires a signature proving you control this wallet, so a message cannot be sent under another address."
              >
                <Button loading={isSigningIn} onClick={signIn}>
                  Sign in with wallet
                </Button>
              </Field>
            )
          ) : null}
        </CardBody>
      </Card>
    </div>
  );
}
