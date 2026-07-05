/**
 * DocumentsClient — per-saved-listing file storage (lease PDFs, listing flyers).
 *
 * Why this is its OWN module and NOT part of UserStore:
 * UserStore has two implementations (localStorage for guests, Supabase for
 * signed-in users) and the whole point is that components never branch on which
 * backend is active. But localStorage genuinely can't hold files. Forcing a
 * "documents" method onto UserStore would mean the local adapter has to throw —
 * breaking the promise that any UserStore method just works. So documents live
 * in a separate, Supabase-only client, and the context exposes it as
 * `documents: DocumentsClient | null` (null = not available, e.g. a guest). The
 * UI checks for null once, instead of catching throws everywhere. Knowing when
 * NOT to extend an interface is as important as extending it.
 *
 * Storage model: files go in a *private* Supabase Storage bucket
 * ("listing-documents"), never the database — databases are for rows, object
 * stores are for blobs. Because the bucket is private, downloads use short-lived
 * *signed URLs* (a temporary, unguessable link) rather than a public URL.
 *
 * Multi-tenancy is path-based: every object is stored under `{userId}/{listingId}/…`.
 * Storage RLS policies (migration 0005) key on that first path segment so a user
 * can only ever touch their own folder — enforced server-side, not just here.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

/** The private bucket holding all listing documents. Created in migration 0005. */
export const DOCUMENTS_BUCKET = 'listing-documents';

/** Client-side upload limits. Mirrored server-side by the bucket config (0005) —
 * defense in depth: the client check is for fast, friendly feedback; the bucket
 * check is the real enforcement a hostile client can't skip. */
export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
export const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png'] as const;

/** One stored document for a listing. */
export interface ListingDocument {
  /** Full storage path ({userId}/{listingId}/{filename}) — the delete/download key. */
  path: string;
  /** Display filename (the last path segment). */
  name: string;
  /** Size in bytes, when the store reports it. */
  size?: number;
}

export interface DocumentsClient {
  list(listingId: string): Promise<ListingDocument[]>;
  upload(listingId: string, file: File): Promise<void>;
  getDownloadUrl(path: string): Promise<string>;
  remove(path: string): Promise<void>;
}

/** Thrown for client-side validation failures (bad type / too big) so the UI can
 * show the message inline. */
export class DocumentError extends Error {}

/**
 * Reduce a filename to a safe, predictable set of characters. Storage keys with
 * spaces, slashes, or unicode can break signed URLs or (with "../") escape the
 * user's folder — so we allow only [a-zA-Z0-9._-] and collapse the rest to '_'.
 */
export function sanitizeFilename(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^\.+/, '');
  return cleaned || 'file';
}

/** Validate a file against the type/size rules; throws DocumentError if it fails. */
function validate(file: File): void {
  if (!ALLOWED_MIME.includes(file.type as (typeof ALLOWED_MIME)[number])) {
    throw new DocumentError('Only PDF, JPEG, or PNG files are allowed.');
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new DocumentError('File is too large (max 10 MB).');
  }
}

/**
 * Build a DocumentsClient bound to one authenticated user. Every path is prefixed
 * with `userId` so RLS (which checks the first path segment) scopes access to
 * this user — the client stays honest even though the server is the real guard.
 */
export function createDocumentsClient(
  supabase: SupabaseClient,
  userId: string
): DocumentsClient {
  const folder = (listingId: string) => `${userId}/${sanitizeFilename(listingId)}`;

  return {
    async list(listingId) {
      const { data, error } = await supabase.storage
        .from(DOCUMENTS_BUCKET)
        .list(folder(listingId));
      if (error) throw error;
      return (data ?? [])
        // Supabase returns a placeholder row for empty folders; skip it.
        .filter((f) => f.name && f.id !== null)
        .map((f) => ({
          path: `${folder(listingId)}/${f.name}`,
          name: f.name,
          size: (f.metadata as { size?: number } | null)?.size,
        }));
    },

    async upload(listingId, file) {
      validate(file);
      const path = `${folder(listingId)}/${sanitizeFilename(file.name)}`;
      const { error } = await supabase.storage
        .from(DOCUMENTS_BUCKET)
        .upload(path, file, { contentType: file.type, upsert: true });
      if (error) throw error;
    },

    async getDownloadUrl(path) {
      // Signed URL: a short-lived (60s) link into the private bucket. Long enough
      // to click through, short enough that a leaked URL is near-useless.
      const { data, error } = await supabase.storage
        .from(DOCUMENTS_BUCKET)
        .createSignedUrl(path, 60);
      if (error) throw error;
      return data.signedUrl;
    },

    async remove(path) {
      const { error } = await supabase.storage.from(DOCUMENTS_BUCKET).remove([path]);
      if (error) throw error;
    },
  };
}
