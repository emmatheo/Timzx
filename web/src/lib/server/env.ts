import 'server-only';

/**
 * Server-only configuration.
 *
 * These values never reach the browser. The service-role key in particular bypasses row level
 * security, so it is read here — in a module that cannot be imported from a client component —
 * rather than anywhere near the `NEXT_PUBLIC_*` surface.
 */
function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `${name} is not set. Server-side Supabase writes and wallet sessions require it.`,
    );
  }
  return value;
}

export function supabaseServiceConfig(): {url: string; serviceRoleKey: string} {
  return {
    url: required('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL),
    serviceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY),
  };
}

export function sessionSecret(): string {
  const secret = required('SESSION_SECRET', process.env.SESSION_SECRET);
  // A short secret makes the HMAC guessable, which would let anyone mint a session for any wallet.
  if (secret.length < 32) throw new Error('SESSION_SECRET must be at least 32 characters.');
  return secret;
}

/** True when the server has everything it needs to authenticate and persist. */
export function isServerConfigured(): boolean {
  try {
    supabaseServiceConfig();
    sessionSecret();
    return true;
  } catch {
    return false;
  }
}
