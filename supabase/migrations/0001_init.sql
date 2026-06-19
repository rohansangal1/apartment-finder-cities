-- Phase 2 schema: accounts, saved listings, first-party reviews (the moat),
-- plus server-side caches that let us rank/rehydrate without re-hitting paid
-- APIs and detect link rot.
--
-- Apply with the Supabase CLI:  supabase db push
-- or paste into the SQL editor in the Supabase dashboard.

-- ─────────────────────────────────────────────────────────────────────────
-- users: one row per authenticated user, keyed to auth.users.id.
-- Stores default search preferences so returning users skip re-entering them.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.users (
  id                   uuid primary key references auth.users (id) on delete cascade,
  email                text,
  home_city            text,
  default_work_address text,
  default_prefs        jsonb,             -- { commuteMode, weights }
  created_at           timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────
-- saved_listings: a user's shortlist. listing_id is the source listing id.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.saved_listings (
  user_id    uuid not null references auth.users (id) on delete cascade,
  listing_id text not null,
  notes      text,
  saved_at   timestamptz not null default now(),
  primary key (user_id, listing_id)
);

-- ─────────────────────────────────────────────────────────────────────────
-- reviews: first-party reviews. lived_here_verified marks users who found the
-- place through the platform — the high-trust signal. Publicly readable.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.reviews (
  id                  uuid primary key default gen_random_uuid(),
  listing_id          text not null,
  user_id             uuid not null references auth.users (id) on delete cascade,
  stars               int  not null check (stars between 1 and 5),
  text                text not null,
  lived_here_verified boolean not null default false,
  created_at          timestamptz not null default now()
);
create index if not exists reviews_listing_idx on public.reviews (listing_id);

-- ─────────────────────────────────────────────────────────────────────────
-- Server-side caches (written by service-role functions, not clients).
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.listings_cache (
  id           text primary key,
  source       text not null,
  source_id    text,
  address      text,
  lat          double precision,
  lng          double precision,
  rent         int,
  beds         int,
  tags         text[],
  listing_url  text,
  last_seen_at timestamptz not null default now()  -- stale rows => link-rot fallback
);

create table if not exists public.commute_cache (
  origin_hash text not null,
  listing_id  text not null,
  mode        text not null,
  minutes     int  not null,
  computed_at timestamptz not null default now(),
  primary key (origin_hash, listing_id, mode)
);

create table if not exists public.rating_cache (
  listing_id  text primary key,
  value       numeric,
  source      text,
  computed_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────
-- Row-Level Security. Users read/write only their own rows; reviews are
-- publicly readable but writable only by their author.
-- ─────────────────────────────────────────────────────────────────────────
alter table public.users          enable row level security;
alter table public.saved_listings enable row level security;
alter table public.reviews        enable row level security;

-- users: a user manages only their own profile row.
create policy "users self read"   on public.users for select using (auth.uid() = id);
create policy "users self upsert" on public.users for insert with check (auth.uid() = id);
create policy "users self update" on public.users for update using (auth.uid() = id);

-- saved_listings: private to the owner.
create policy "saved self read"   on public.saved_listings for select using (auth.uid() = user_id);
create policy "saved self insert" on public.saved_listings for insert with check (auth.uid() = user_id);
create policy "saved self delete" on public.saved_listings for delete using (auth.uid() = user_id);

-- reviews: world-readable, author-writable.
create policy "reviews public read" on public.reviews for select using (true);
create policy "reviews author insert" on public.reviews for insert with check (auth.uid() = user_id);
create policy "reviews author update" on public.reviews for update using (auth.uid() = user_id);
create policy "reviews author delete" on public.reviews for delete using (auth.uid() = user_id);

-- Caches are server-managed (service role bypasses RLS); leave RLS off so the
-- public anon key cannot read/write them directly.
