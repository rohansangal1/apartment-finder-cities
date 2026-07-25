import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Trash2, Upload } from 'lucide-react';
import { useUserData } from '../context/user-data-context';
import {
  DocumentError,
  type ListingDocument,
} from '../lib/user-data/documents';

/**
 * Attach lease / listing PDFs (and images) to one saved listing.
 *
 * Documents are Supabase-only, so `documents` from context is null for guests —
 * we render a sign-in prompt in that case (mirroring the saved-view copy) rather
 * than a broken uploader. When available: a file list with download (via a
 * short-lived signed URL) and delete, plus a styled file input that surfaces
 * client-side validation errors inline before anything is uploaded.
 */
export default function DocumentSection({ listingId }: { listingId: string }) {
  const { documents } = useUserData();

  // Guests / no Supabase: documents is null. Show the sign-in prompt, not an
  // uploader that can't work.
  if (!documents) {
    return (
      <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
        <Link to="/account" className="font-medium text-brand-600 hover:underline">
          Sign in
        </Link>{' '}
        to attach documents (lease, listing PDF) to this apartment.
      </p>
    );
  }

  return <DocumentList listingId={listingId} documents={documents} />;
}

function DocumentList({
  listingId,
  documents,
}: {
  listingId: string;
  documents: NonNullable<ReturnType<typeof useUserData>['documents']>;
}) {
  const [files, setFiles] = useState<ListingDocument[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      setFiles(await documents.list(listingId));
    } catch (e) {
      console.error('Failed to list documents', e);
      setFiles([]);
    }
  }, [documents, listingId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset the input so selecting the same file again still fires onChange.
    e.target.value = '';
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      await documents.upload(listingId, file);
      await refresh();
    } catch (err) {
      // DocumentError = a validation message meant for the user; anything else is
      // an unexpected failure we show generically.
      setError(err instanceof DocumentError ? err.message : 'Upload failed. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const onDownload = async (doc: ListingDocument) => {
    try {
      const url = await documents.getDownloadUrl(doc.path);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      console.error('Failed to create download link', e);
      setError('Could not open that file. Try again.');
    }
  };

  const onDelete = async (doc: ListingDocument) => {
    if (!window.confirm(`Delete "${doc.name}"? This can't be undone.`)) return;
    try {
      await documents.remove(doc.path);
      await refresh();
    } catch (e) {
      console.error('Failed to delete document', e);
      setError('Could not delete that file. Try again.');
    }
  };

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Documents</p>

      {files && files.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {files.map((f) => (
            <li key={f.path} className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              <button
                type="button"
                onClick={() => onDownload(f)}
                className="min-w-0 flex-1 truncate text-left font-medium text-brand-600 hover:underline"
                title={f.name}
              >
                {f.name}
              </button>
              {typeof f.size === 'number' && (
                <span className="shrink-0 text-xs text-slate-400">{formatBytes(f.size)}</span>
              )}
              <button
                type="button"
                onClick={() => onDelete(f)}
                aria-label={`Delete ${f.name}`}
                className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {files && files.length === 0 && (
        <p className="mt-2 text-xs text-slate-500">No documents yet.</p>
      )}

      <div className="mt-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-ink-700 px-3 py-1.5 text-sm font-medium text-slate-700 hover:text-slate-900 disabled:opacity-60"
        >
          <Upload className="h-4 w-4" aria-hidden="true" />
          {busy ? 'Uploading…' : 'Add document'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,image/jpeg,image/png"
          onChange={onSelect}
          className="hidden"
        />
        <p className="mt-1.5 text-xs text-slate-400">PDF, JPEG, or PNG · up to 10 MB</p>
      </div>

      {error && <p className="mt-2 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}

/** Human-readable byte size, e.g. 1536 -> "1.5 KB". */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb < 10 ? 1 : 0)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}
