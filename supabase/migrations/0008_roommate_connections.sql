-- 0008: Roommate connection requests — the mutual opt-in reveal.
--
-- Apply with:  supabase db push   (or paste into the Supabase SQL editor)
--
-- A connection is a directed request (requester -> target). Contact email is
-- exchanged ONLY once status = 'accepted'. The reveal itself is done server-side in
-- /api/roommate-connect (service role), which reads each side's social_profiles
-- contact_email and returns it only for accepted rows. RLS here lets each party
-- read/manage rows they participate in, so the UI can show pending/sent/accepted
-- lists without the service role for the common cases.

create table if not exists public.roommate_connections (
  id            uuid primary key default gen_random_uuid(),
  requester_id  uuid not null references auth.users (id) on delete cascade,
  target_id     uuid not null references auth.users (id) on delete cascade,
  status        text not null default 'pending'
                  check (status in ('pending', 'accepted', 'declined')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- One live request per direction; re-requesting updates the same row.
  unique (requester_id, target_id)
);

create index if not exists roommate_connections_target_idx
  on public.roommate_connections (target_id, status);
create index if not exists roommate_connections_requester_idx
  on public.roommate_connections (requester_id, status);

alter table public.roommate_connections enable row level security;

-- Either participant may read the row.
create policy "connections participant read" on public.roommate_connections
  for select using (auth.uid() = requester_id or auth.uid() = target_id);
-- Only the requester may create a request, and only as themselves.
create policy "connections requester insert" on public.roommate_connections
  for insert with check (auth.uid() = requester_id);
-- Either participant may update status (requester to cancel, target to accept/decline).
create policy "connections participant update" on public.roommate_connections
  for update using (auth.uid() = requester_id or auth.uid() = target_id)
  with check (auth.uid() = requester_id or auth.uid() = target_id);
