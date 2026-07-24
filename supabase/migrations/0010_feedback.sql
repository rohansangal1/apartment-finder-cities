-- 0010: Feedback — suggestions, ideas, and questions from visitors.
--
-- Apply with:  supabase db push   (or paste into the Supabase SQL editor)
--
-- Nester is still being built, so the fastest way to learn what's wrong is to let
-- anyone say so without signing up first. That means the write path is anonymous,
-- which is why this table is locked down harder than the rest: RLS is ON with
-- ZERO policies, so the anon and authenticated browser clients can neither read
-- nor write it. Rows arrive only through /api/feedback, which uses the
-- service-role key (RLS-exempt) behind that endpoint's per-IP rate limit. A
-- public insert policy would have let anyone spam the table straight from the
-- browser, skipping that limit entirely.
--
-- Read submissions in the Supabase dashboard (table editor / SQL editor), which
-- also connects as service-role.

create table if not exists public.feedback (
  id            uuid primary key default gen_random_uuid(),
  -- Nullable: most feedback is anonymous. Kept for the day the form is sent from
  -- a signed-in session; `set null` so deleting an account doesn't drop the note.
  user_id       uuid references auth.users (id) on delete set null,
  contact_email text check (char_length(contact_email) <= 200),
  message       text not null check (char_length(message) between 1 and 2000),
  -- The route the visitor was on when they wrote in.
  path          text check (char_length(path) <= 200),
  created_at    timestamptz not null default now()
);

-- Newest-first is the only way this gets read.
create index if not exists feedback_created_idx on public.feedback (created_at desc);

alter table public.feedback enable row level security;
-- Intentionally no policies. See the header comment.
