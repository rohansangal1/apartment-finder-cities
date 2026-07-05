-- 0005: Per-saved-listing document storage (lease PDFs, listing flyers).
--
-- Apply with:  supabase db push   (or paste into the Supabase SQL editor)
-- The client degrades gracefully if this hasn't been applied yet: guests and
-- unconfigured environments get `documents: null` and a sign-in prompt.
--
-- Model: files live in a PRIVATE Supabase Storage bucket, not the database.
-- Object stores are for blobs; databases are for rows. Access is scoped by PATH:
-- every object is stored under `{userId}/{listingId}/{filename}`, and the RLS
-- policies below only let a user touch rows whose first path segment is their own
-- auth.uid(). That's path-based multi-tenancy — the folder name IS the tenant key.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Create the private bucket with server-side type/size limits.
--    These MIRROR the client checks in documents.ts on purpose — defense in
--    depth. The client validation is for fast, friendly errors; this is the
--    enforcement a hostile client (bypassing our JS) can't skip.
--      file_size_limit    = 10 MB (10485760 bytes)
--      allowed_mime_types = PDF, JPEG, PNG only
--    `public = false` means no public URLs — downloads require a signed URL.
--    Guarded via on-conflict so re-running the migration is safe.
-- ─────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'listing-documents',
  'listing-documents',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. RLS on storage.objects, scoped to the owner's top-level folder.
--
--    `storage.foldername(name)` splits an object path into its folder segments,
--    so `(storage.foldername(name))[1]` is the first segment — our {userId}. We
--    require it to equal the caller's auth.uid(), so a user can only read/write/
--    delete inside their own `{userId}/…` prefix. (If storage.foldername isn't
--    available in your Postgres, swap it for `split_part(name, '/', 1)`.)
--
--    Policies are bucket-scoped (`bucket_id = 'listing-documents'`) so they don't
--    affect any other bucket. Guarded with drop-if-exists for safe re-runs.
-- ─────────────────────────────────────────────────────────────────────────
drop policy if exists "listing docs self read"   on storage.objects;
drop policy if exists "listing docs self insert" on storage.objects;
drop policy if exists "listing docs self delete" on storage.objects;

create policy "listing docs self read" on storage.objects
  for select using (
    bucket_id = 'listing-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "listing docs self insert" on storage.objects
  for insert with check (
    bucket_id = 'listing-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "listing docs self delete" on storage.objects
  for delete using (
    bucket_id = 'listing-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
