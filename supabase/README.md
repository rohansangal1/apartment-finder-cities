# Supabase setup (Phase 2)

Accounts, saved listings, default preferences, and first-party reviews — the
moat — live in Supabase (Postgres + Auth + Row-Level Security). The app runs
fine **without** this configured (guest mode, localStorage); these steps light
up the real, synced experience.

## 1. Create the project + schema

1. Create a project at [supabase.com](https://supabase.com).
2. Apply the schema: paste [`migrations/0001_init.sql`](migrations/0001_init.sql)
   into the SQL editor and run it (or `supabase db push` with the CLI).
   This creates `users`, `saved_listings`, `reviews`, the `*_cache` tables, and
   all RLS policies.

## 2. Enable Google sign-in (configuration, not code)

1. In **Google Cloud Console** → APIs & Services → Credentials, create an
   **OAuth 2.0 Client ID** (Web application). Configure the consent screen with
   the `email` + `profile` scopes.
2. Add Supabase's callback as an authorized redirect URI:
   `https://<project-ref>.supabase.co/auth/v1/callback`
3. In Supabase → Authentication → Providers → **Google**, paste the client ID +
   secret and enable it.

The app already calls `supabase.auth.signInWithOAuth({ provider: 'google' })`
(see [`src/context/AuthContext.tsx`](../src/context/AuthContext.tsx)) — no auth
backend code needed.

## 3. Point the app at Supabase

Add to your environment (Vercel project settings, or `.env` locally):

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon public key>
```

The anon key is safe in the browser — **RLS** is what protects data, not key
secrecy. Restart/redeploy; the Account view's Google button activates and saved
listings / reviews / preferences move from localStorage to per-user Postgres.

## 4. Before public launch

- **Verify the app** on Google's OAuth consent screen, or users see an
  "unverified app" warning and you're capped to a handful of test users.
- Ship a **privacy policy** — work addresses are sensitive location data. Rely on
  Supabase's encryption at rest and don't over-collect.

## What's wired vs. what's left

**Wired now:** Google auth, per-user saved listings, default preferences,
first-party review read/write, RLS, guest→DB fallback.

**Still server-side TODO (uses `service_role`, not the anon client):**
- Blending first-party reviews into `rating_cache` (extend Phase 1's
  `api/_lib/ratings.ts` to read the `reviews` table).
- Scheduled jobs (Vercel Cron / Supabase scheduled functions) to refresh
  `listings_cache` for active cities and re-check `listing_url` freshness so the
  link-rot fallback kicks in.
