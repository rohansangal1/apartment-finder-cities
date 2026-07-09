/**
 * Server-only Supabase access for the social endpoints.
 *
 * The service-role key BYPASSES Row-Level Security, so it can read across users —
 * exactly what roommate matching needs, and exactly why it must never reach the
 * browser. It lives only in the serverless runtime (Vercel project settings /
 * `.env`) and is never VITE_-prefixed. Callers must only ever return DERIVED /
 * anonymized data to the client (signals, not raw saves; emails only on mutual
 * accept).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { VercelRequest } from '@vercel/node';
import { HttpError } from './env.js';

let cached: SupabaseClient | null = null;

/** Build (once) the service-role client. */
export function adminClient(): SupabaseClient {
  if (cached) return cached;
  // Accept either the server var or the VITE_ URL (same project, public value).
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new HttpError(
      503,
      'Social features need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY set in the ' +
        'server environment (Vercel project settings / .env for `vercel dev`).'
    );
  }
  cached = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return cached;
}

/**
 * Verify the caller's Supabase JWT (sent as `Authorization: Bearer <token>`) and
 * return their user id. Throws 401 if missing/invalid. The service-role client can
 * validate any project token via auth.getUser(token).
 */
export async function requireUserId(req: VercelRequest): Promise<string> {
  const header = req.headers.authorization;
  const token =
    typeof header === 'string' && header.startsWith('Bearer ')
      ? header.slice('Bearer '.length).trim()
      : null;
  if (!token) throw new HttpError(401, 'Sign in required.');
  const { data, error } = await adminClient().auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, 'Invalid or expired session.');
  return data.user.id;
}
