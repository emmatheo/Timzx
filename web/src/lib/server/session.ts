import 'server-only';

import {createHmac, timingSafeEqual} from 'node:crypto';
import {cookies} from 'next/headers';

import {sessionSecret} from './env';

export const SESSION_COOKIE = 'timx_session';
const SESSION_TTL_SECONDS = 60 * 60 * 12;

interface SessionPayload {
  address: string;
  /** Unix seconds. */
  exp: number;
}

function sign(value: string): string {
  return createHmac('sha256', sessionSecret()).update(value).digest('base64url');
}

/**
 * Constant-time signature comparison.
 *
 * `timingSafeEqual` throws on length mismatch, and a plain `===` on the digest would leak how much
 * of a forged signature was correct. Both are handled here so callers cannot get it wrong.
 */
function signatureMatches(expected: string, actual: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(actual);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function encodeSession(address: string): {value: string; maxAge: number} {
  const payload: SessionPayload = {
    address: address.toLowerCase(),
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return {value: `${body}.${sign(body)}`, maxAge: SESSION_TTL_SECONDS};
}

/** The wallet address this request is authenticated as, or null. */
export async function currentAddress(): Promise<string | null> {
  const raw = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!raw) return null;

  const [body, signature] = raw.split('.');
  if (!body || !signature) return null;
  if (!signatureMatches(sign(body), signature)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as SessionPayload;
    if (typeof payload.address !== 'string' || typeof payload.exp !== 'number') return null;
    if (payload.exp * 1000 < Date.now()) return null;
    return payload.address;
  } catch {
    return null;
  }
}
