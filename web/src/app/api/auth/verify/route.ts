import {NextResponse} from 'next/server';
import {isAddress, verifyMessage, type Hex} from 'viem';

import {encodeSession, SESSION_COOKIE} from '@/lib/server/session';
import {signInMessage} from '@/lib/sign-in-message';
import {supabaseAdmin} from '@/lib/server/supabase-admin';

export const dynamic = 'force-dynamic';

/**
 * Verifies a wallet signature and issues a session cookie.
 *
 * The nonce is deleted as part of verification, so a replayed signature finds nothing to consume
 * and is rejected. The message is reconstructed here from the stored nonce rather than taken from
 * the request, so a caller cannot get a signature over text of their choosing accepted.
 */
export async function POST(request: Request) {
  let address: unknown;
  let signature: unknown;
  try {
    ({address, signature} = (await request.json()) as {address?: unknown; signature?: unknown});
  } catch {
    return NextResponse.json({error: 'Malformed request body.'}, {status: 400});
  }

  if (typeof address !== 'string' || !isAddress(address)) {
    return NextResponse.json({error: 'A valid wallet address is required.'}, {status: 400});
  }
  if (typeof signature !== 'string' || !signature.startsWith('0x')) {
    return NextResponse.json({error: 'A signature is required.'}, {status: 400});
  }

  const lower = address.toLowerCase();
  const db = supabaseAdmin();

  const {data: row} = await db
    .from('auth_nonces')
    .select('nonce, expires_at')
    .eq('address', lower)
    .order('created_at', {ascending: false})
    .limit(1)
    .maybeSingle();

  if (!row) {
    return NextResponse.json({error: 'No pending sign-in. Request a nonce first.'}, {status: 400});
  }
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await db.from('auth_nonces').delete().eq('nonce', row.nonce);
    return NextResponse.json({error: 'Sign-in request expired. Try again.'}, {status: 400});
  }

  const valid = await verifyMessage({
    address: address as `0x${string}`,
    message: signInMessage(address, row.nonce),
    signature: signature as Hex,
  }).catch(() => false);

  // Consume the nonce whether or not the signature checked out, so a failed attempt cannot be
  // retried against the same challenge.
  await db.from('auth_nonces').delete().eq('nonce', row.nonce);

  if (!valid) {
    return NextResponse.json({error: 'Signature did not match that address.'}, {status: 401});
  }

  await db.from('profiles').upsert({wallet_address: lower}, {onConflict: 'wallet_address'});

  const session = encodeSession(lower);
  const response = NextResponse.json({address: lower});
  response.cookies.set(SESSION_COOKIE, session.value, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: session.maxAge,
  });
  return response;
}
