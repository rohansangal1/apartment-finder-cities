-- 0004: Security hardening + saved searches.
--
-- Apply with:  supabase db push   (or paste into the Supabase SQL editor)
-- The client degrades gracefully if this hasn't been applied yet.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Cache tables were left with RLS *disabled* (see 0001_init.sql:104-105).
--    That reasoning was backwards: tables in the `public` schema are exposed
--    through PostgREST and the `anon` role gets default grants, so RLS-OFF
--    means anyone with the (public) anon key can read AND write them directly
--    — i.e. cache poisoning of rents/commutes/ratings that feed scoring.
--
--    The server writes these with the service-role key, which BYPASSES RLS.
--    So enabling RLS with NO policy blocks the anon/authenticated roles while
--    leaving server-side caching fully functional.
-- ─────────────────────────────────────────────────────────────────────────
alter table public.listings_cache enable row level security;
alter table public.commute_cache  enable row level security;
alter table public.rating_cache   enable row level security;
-- (No policies created on purpose — only the service role should touch these.)

-- ─────────────────────────────────────────────────────────────────────────
-- 2. saved_listings was missing an UPDATE policy, so note edits (setNote issues
--    an UPDATE) silently failed under RLS for signed-in users. Add it.
-- ─────────────────────────────────────────────────────────────────────────
create policy "saved self update" on public.saved_listings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Bound review text to prevent oversized/spam payloads (mirrors the client
--    cap in review-form.tsx). Guarded so re-running the migration is safe.
-- ─────────────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'reviews_text_len'
  ) then
    alter table public.reviews
      add constraint reviews_text_len check (char_length(text) <= 2000);
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Completeness: let a user delete their own profile row.
-- ─────────────────────────────────────────────────────────────────────────
create policy "users self delete" on public.users
  for delete using (auth.uid() = id);

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Saved searches (Feature B4). A named, re-runnable SearchCriteria snapshot,
--    private to its owner. Mirrors saved_listings' self-scoped RLS.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.saved_searches (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null check (char_length(name) <= 120),
  criteria   jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists saved_searches_user_idx
  on public.saved_searches (user_id, created_at desc);

alter table public.saved_searches enable row level security;

create policy "searches self read"   on public.saved_searches
  for select using (auth.uid() = user_id);
create policy "searches self insert" on public.saved_searches
  for insert with check (auth.uid() = user_id);
create policy "searches self delete" on public.saved_searches
  for delete using (auth.uid() = user_id);
