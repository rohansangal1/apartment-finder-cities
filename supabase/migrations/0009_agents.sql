-- 0009: Agent profiles + leads — self-serve real-estate agents.
--
-- Apply with:  supabase db push   (or paste into the Supabase SQL editor)
--
-- Agents WANT to be found, so an opted-in agent's directory row is world-readable
-- (modeled on the public reviews table in 0001) — searchers read it directly with
-- the browser anon client, no service role needed. Writes are self-scoped: a user
-- may only create/edit their own agent row.

create table if not exists public.agent_profiles (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  is_agent      boolean not null default false,
  display_name  text check (char_length(display_name) <= 120),
  brokerage     text check (char_length(brokerage) <= 160),
  license_no    text check (char_length(license_no) <= 60),
  cities        text[] not null default '{}',
  bio           text check (char_length(bio) <= 600),
  photo_url     text check (char_length(photo_url) <= 500),
  contact_email text check (char_length(contact_email) <= 200),
  booking_url   text check (char_length(booking_url) <= 500),
  specialties   text[] not null default '{}',
  verified      boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Directory browse filters on is_agent; GIN index accelerates city array lookups.
create index if not exists agent_profiles_cities_idx
  on public.agent_profiles using gin (cities) where is_agent = true;

alter table public.agent_profiles enable row level security;

-- World-readable, but only for live agent rows (opted-in). Same public-read shape
-- as reviews in 0001.
create policy "agents public read" on public.agent_profiles
  for select using (is_agent = true);
-- An agent can always read their OWN row, even mid-onboarding (is_agent still false).
create policy "agents self read" on public.agent_profiles
  for select using (auth.uid() = user_id);
create policy "agents self insert" on public.agent_profiles
  for insert with check (auth.uid() = user_id);
create policy "agents self update" on public.agent_profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "agents self delete" on public.agent_profiles
  for delete using (auth.uid() = user_id);

-- A lead: a searcher reaching out to an agent. The agent reads their own leads;
-- searchers insert (and read their own). Nobody else can see them.
create table if not exists public.agent_leads (
  id           uuid primary key default gen_random_uuid(),
  agent_id     uuid not null references auth.users (id) on delete cascade,
  searcher_id  uuid not null references auth.users (id) on delete cascade,
  city         text check (char_length(city) <= 120),
  message      text check (char_length(message) <= 1000),
  created_at   timestamptz not null default now()
);

create index if not exists agent_leads_agent_idx
  on public.agent_leads (agent_id, created_at desc);

alter table public.agent_leads enable row level security;

create policy "leads agent or searcher read" on public.agent_leads
  for select using (auth.uid() = agent_id or auth.uid() = searcher_id);
create policy "leads searcher insert" on public.agent_leads
  for insert with check (auth.uid() = searcher_id);
