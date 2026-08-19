import {createClient, type SupabaseClient} from '@supabase/supabase-js';

import {supabaseConfig} from '@/lib/config/env';
import type {Database} from './types';

let cached: SupabaseClient<Database> | null = null;

/**
 * Supabase client, or null when Supabase is not configured.
 *
 * Returning null rather than throwing is deliberate: Supabase holds descriptive metadata only, so
 * the product stays fully usable without it — trades, balances and attestations all come from the
 * chain. Callers degrade to on-chain-only views instead of erroring.
 */
export function getSupabase(): SupabaseClient<Database> | null {
  if (!supabaseConfig.url || !supabaseConfig.anonKey) return null;
  if (!cached) {
    cached = createClient<Database>(supabaseConfig.url, supabaseConfig.anonKey, {
      auth: {persistSession: false},
    });
  }
  return cached;
}
