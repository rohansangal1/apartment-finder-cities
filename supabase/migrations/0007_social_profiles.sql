-- 0007: Social profiles — the opt-in foundation for roommate matching.
--
-- Apply with:  supabase db push   (or paste into the Supabase SQL editor)
-- The client degrades gracefully if this hasn't been applied yet: getSocialProfile
-- fails soft and the UI shows the opted-out / "enable in Account" state.
--
-- A per-user social profile that is INVISIBLE until the user flips roommate_opt_in.
-- Same self-scoped RLS shape as saved_addresses (0006): a user_id PK/FK, RLS on,
-- and select/insert/update/delete policies all keyed on auth.uid() = user_id.
--
-- IMPORTANT: this table is owner-only even for reads. The browser anon client never
-- reads other people's profiles. Cross-user matching is done SERVER-SIDE in
-- /api/match-roommates using the service-role key, which bypasses RLS, and only ever
-- returns derived/anonymized signals (never raw saved addresses or private notes).

create table if not exists public.social_profiles (
  user_id          uuid primary key references auth.users (id) on delete cascade,
  roommate_opt_in  boolean not null default false,
  display_name     text check (char_length(display_name) <= 120),
  bio              text check (char_length(bio) <= 500),
  age_range        text check (char_length(age_range) <= 20),
  move_in_month    text check (char_length(move_in_month) <= 20),
  budget_min       integer,
  budget_max       integer,
  contact_email    text check (char_length(contact_email) <= 200),
  -- roommate_signal: derived, coarse buckets (cities, budget band, bed counts,
  -- neighborhoods) recomputed whenever an opted-in user saves/unsaves a listing.
  -- This is the ONLY thing the matcher compares — never the raw saved snapshots.
  roommate_signal  jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- The matcher (service role) scans opted-in rows; index makes that scan cheap.
create index if not exists social_profiles_optin_idx
  on public.social_profiles (roommate_opt_in) where roommate_opt_in = true;

alter table public.social_profiles enable row level security;

create policy "social self read"   on public.social_profiles
  for select using (auth.uid() = user_id);
create policy "social self insert" on public.social_profiles
  for insert with check (auth.uid() = user_id);
create policy "social self update" on public.social_profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "social self delete" on public.social_profiles
  for delete using (auth.uid() = user_id);
