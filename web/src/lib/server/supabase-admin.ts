import 'server-only';

import {createClient, type SupabaseClient} from '@supabase/supabase-js';

import {supabaseServiceConfig} from './env';
import type {Database} from '@/lib/supabase/types';

let cached: SupabaseClient<Database> | null = null;

/**
 * Supabase client holding the service role.
 *
 * Bypasses row level security, so every route that uses it must establish who is calling and what
 * they may touch *before* it writes. RLS is the last line, not the only one: the anon key shipped
 * to the browser is read-only by policy, and all writes come through here after a verified
 * wallet signature.
 */
export function supabaseAdmin(): SupabaseClient<Database> {
  if (!cached) {
    const {url, serviceRoleKey} = supabaseServiceConfig();
    cached = createClient<Database>(url, serviceRoleKey, {
      auth: {persistSession: false, autoRefreshToken: false},
    });
  }
  return cached;
}
