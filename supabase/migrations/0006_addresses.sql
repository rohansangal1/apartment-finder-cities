-- 0006: Saved work addresses.
--
-- Apply with:  supabase db push   (or paste into the Supabase SQL editor)
-- The client degrades gracefully if this hasn't been applied yet: listAddresses
-- just fails soft and the UI shows an empty list.
--
-- A reusable work address so users don't retype "Salesforce Tower, San
-- Francisco" every search. Private to its owner — same self-scoped RLS shape as
-- saved_listings / saved_searches (see 0004). This is the pattern to copy for any
-- future per-user table: a user_id FK, an owner index, RLS on, and select/insert/
-- delete policies all keyed on auth.uid() = user_id.

create table if not exists public.saved_addresses (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  label      text not null check (char_length(label) <= 120),
  address    text not null check (char_length(address) <= 400),
  created_at timestamptz not null default now()
);

create index if not exists saved_addresses_user_idx
  on public.saved_addresses (user_id, created_at desc);

alter table public.saved_addresses enable row level security;

create policy "addresses self read"   on public.saved_addresses
  for select using (auth.uid() = user_id);
create policy "addresses self insert" on public.saved_addresses
  for insert with check (auth.uid() = user_id);
create policy "addresses self delete" on public.saved_addresses
  for delete using (auth.uid() = user_id);
