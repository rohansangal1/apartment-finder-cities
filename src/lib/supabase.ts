/**
 * Supabase client (Phase 2). Created from public env vars (the anon key is safe
 * in the browser — Row-Level Security is what protects data, not key secrecy).
 *
 * If the env vars aren't set, `supabase` is null and `isSupabaseEnabled` is
 * false. The whole app still runs: auth is disabled, and user data falls back to
 * localStorage (guest mode). This keeps Phase 0/1 development working without a
 * Supabase project, and lets Phase 2 light up by just adding the two vars.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env?.VITE_SUPABASE_URL;
const anonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY;

export const isSupabaseEnabled = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = isSupabaseEnabled
  ? createClient(url as string, anonKey as string, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;
