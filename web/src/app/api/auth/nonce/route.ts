import {randomBytes} from 'node:crypto';
import {NextResponse} from 'next/server';
import {isAddress} from 'viem';

import {supabaseAdmin} from '@/lib/server/supabase-admin';

export const dynamic = 'force-dynamic';

/**
 * Issues a single-use nonce for wallet sign-in.
 *
 * Stored server-side rather than handed out statelessly so it can be consumed exactly once —
 * without that, a captured signature could be replayed indefinitely to mint fresh sessions.
 */
export async function POST(request: Request) {
  let address: unknown;
  try {
    ({address} = (await request.json()) as {address?: unknown});
  } catch {
    return NextResponse.json({error: 'Malformed request body.'}, {status: 400});
  }

  if (typeof address !== 'string' || !isAddress(address)) {
    return NextResponse.json({error: 'A valid wallet address is required.'}, {status: 400});
  }

  const nonce = randomBytes(24).toString('base64url');
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  const {error} = await supabaseAdmin()
    .from('auth_nonces')
    .insert({nonce, address: address.toLowerCase(), expires_at: expiresAt});

  if (error) {
    return NextResponse.json({error: 'Could not issue a nonce.'}, {status: 500});
  }

  return NextResponse.json({nonce, expiresAt});
}
