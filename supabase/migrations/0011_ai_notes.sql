-- 0011: AI-generated notes about a listing.
--
-- Apply with:  supabase db push   (or paste into the Supabase SQL editor)
-- The client degrades gracefully if this hasn't been applied yet: getAiNotes
-- fails soft and every listing simply shows the "Generate notes" button.
--
-- Deliberately NOT a column on saved_listings. Notes can be generated from a
-- results card before anything is saved, and forcing a save to hold them would
-- put junk in the shortlist. Keyed on listing_id instead, so notes written
-- before a save are already attached when the user hearts the listing.
--
-- Same self-scoped RLS shape as saved_addresses (see 0006): user_id FK, owner
-- index, RLS on, policies keyed on auth.uid() = user_id. Update is included
-- because the store upserts.

create table if not exists public.ai_notes (
  user_id    uuid not null references auth.users (id) on delete cascade,
  listing_id text not null,
  -- The whole AiNotes record: text, sources, model, generatedAt. JSON so a
  -- change to the note shape doesn't need a migration.
  notes      jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

create index if not exists ai_notes_user_idx
  on public.ai_notes (user_id, created_at desc);

alter table public.ai_notes enable row level security;

create policy "ai notes self read"   on public.ai_notes
  for select using (auth.uid() = user_id);
create policy "ai notes self insert" on public.ai_notes
  for insert with check (auth.uid() = user_id);
create policy "ai notes self update" on public.ai_notes
  for update using (auth.uid() = user_id);
create policy "ai notes self delete" on public.ai_notes
  for delete using (auth.uid() = user_id);
