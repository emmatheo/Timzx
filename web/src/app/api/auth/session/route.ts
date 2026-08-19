import {NextResponse} from 'next/server';

import {currentAddress, SESSION_COOKIE} from '@/lib/server/session';

export const dynamic = 'force-dynamic';

/** Reports the address this browser is authenticated as, if any. */
export async function GET() {
  return NextResponse.json({address: await currentAddress()});
}

/** Signs out by clearing the session cookie. */
export async function DELETE() {
  const response = NextResponse.json({address: null});
  response.cookies.set(SESSION_COOKIE, '', {path: '/', maxAge: 0});
  return response;
}
