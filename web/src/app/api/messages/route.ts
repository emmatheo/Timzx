import {NextResponse} from 'next/server';
import {isAddress} from 'viem';

import {currentAddress} from '@/lib/server/session';
import {supabaseAdmin} from '@/lib/server/supabase-admin';

export const dynamic = 'force-dynamic';

const TRADE_ID = /^\d{1,78}$/;
const MAX_BODY = 4000;

/** Correspondence on a trade, oldest first so the thread reads top to bottom. */
export async function GET(request: Request) {
  const tradeId = new URL(request.url).searchParams.get('tradeId');
  if (!tradeId || !TRADE_ID.test(tradeId)) {
    return NextResponse.json({error: 'A numeric tradeId is required.'}, {status: 400});
  }

  const {data, error} = await supabaseAdmin()
    .from('messages')
    .select('*')
    .eq('trade_id', tradeId)
    .order('created_at', {ascending: true})
    .limit(500);

  if (error) return NextResponse.json({error: 'Could not load messages.'}, {status: 500});
  return NextResponse.json({messages: data ?? []});
}

/**
 * Posts a message to a trade thread.
 *
 * The sender is the session address. Accepting it from the body would let anyone post as anyone,
 * which for correspondence attached to a financing agreement is not a small thing.
 */
export async function POST(request: Request) {
  const address = await currentAddress();
  if (!address) {
    return NextResponse.json({error: 'Sign in with your wallet first.'}, {status: 401});
  }
  if (!isAddress(address)) {
    return NextResponse.json({error: 'Session address is malformed.'}, {status: 401});
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({error: 'Malformed request body.'}, {status: 400});
  }

  const tradeId = body.tradeId;
  const text = body.body;

  if (typeof tradeId !== 'string' || !TRADE_ID.test(tradeId)) {
    return NextResponse.json({error: 'A numeric tradeId is required.'}, {status: 400});
  }
  if (typeof text !== 'string' || text.trim().length === 0 || text.length > MAX_BODY) {
    return NextResponse.json(
      {error: `A message body of 1-${MAX_BODY} characters is required.`},
      {status: 400},
    );
  }

  const {data, error} = await supabaseAdmin()
    .from('messages')
    .insert({trade_id: tradeId, sender_address: address, body: text.trim()})
    .select()
    .single();

  if (error) return NextResponse.json({error: 'Could not send the message.'}, {status: 500});
  return NextResponse.json({message: data}, {status: 201});
}
