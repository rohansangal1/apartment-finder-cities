import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import type { Listing } from '../lib/types';
import { useUserData } from '../context/user-data-context';
import { useAuth } from '../context/auth-context';
import AiNotesPanel from './ai-notes-panel';
import NotesBody from './ai-notes-body';

/**
 * AI notes for one listing: the trigger, or the notes themselves.
 *
 * These are two states of one thing, which is why they live in one component.
 * Notes are generated once per listing, so once a set exists the button has
 * nothing left to do and is replaced by what it produced. A run that fails or is
 * discarded saves nothing, so the button stays and the user can try again —
 * that's the only retry path, and the right one.
 *
 * Notes are keyed on listing id independently of the shortlist, so generating
 * from a results card doesn't force a save, and a listing saved afterwards
 * arrives in Saved with its notes already attached.
 *
 * `variant="compact"` is for the results grid, where a full notes block would
 * wreck the scannability of the card: it shows a one-line summary that expands.
 *
 * Generating requires an account, because each run spends from a shared model
 * quota the server has to attribute to someone. Notes already generated stay
 * visible regardless — hiding what someone already has would be a punishment,
 * not a gate.
 */
export default function AiNotesButton({
  listing,
  variant = 'full',
  className = '',
}: {
  listing: Listing;
  variant?: 'full' | 'compact';
  className?: string;
}) {
  const { aiNotes } = useUserData();
  const { enabled: authEnabled, user } = useAuth();
  const [open, setOpen] = useState(false);
  const notes = aiNotes[listing.id];

  if (notes) {
    return variant === 'compact' ? (
      <details className={`group ${className}`}>
        <summary className="flex cursor-pointer select-none items-center gap-1.5 text-sm font-medium text-brand-600 [&::-webkit-details-marker]:hidden">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          Your notes
        </summary>
        <div className="mt-2">
          <NotesBody text={notes.text} />
          <Attribution sources={notes.sources} model={notes.model} />
        </div>
      </details>
    ) : (
      <div className={`mt-3 rounded-lg bg-ink-900/60 px-3 py-2.5 ${className}`}>
        <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brand-500">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          Notes
        </p>
        <NotesBody text={notes.text} />
        <Attribution sources={notes.sources} model={notes.model} />
      </div>
    );
  }

  // Auth isn't configured at all (guest-mode build): the endpoint would reject
  // every run, so offering the trigger would be a lie. Show nothing instead.
  if (!authEnabled) return null;

  if (!user) {
    return (
      <Link
        to="/account"
        title="Sign in to generate notes about this place"
        className={
          variant === 'compact'
            ? `inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-brand-600 ${className}`
            : `mt-3 inline-flex items-center gap-2 rounded-lg border border-ink-600 px-3 py-2 text-sm font-medium text-slate-500 transition hover:border-brand-600 hover:text-brand-600 ${className}`
        }
      >
        <Sparkles className="h-4 w-4 text-brand-500" aria-hidden="true" />
        Sign in for notes
      </Link>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Generate notes about this place"
        className={
          variant === 'compact'
            ? `inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700 ${className}`
            : `mt-3 inline-flex items-center gap-2 rounded-lg border border-ink-600 px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-brand-600 hover:text-brand-600 ${className}`
        }
      >
        <Sparkles className="h-4 w-4 text-brand-500" aria-hidden="true" />
        Generate notes
      </button>
      {open && <AiNotesPanel listing={listing} onClose={() => setOpen(false)} />}
    </>
  );
}

/** Credit the actual lookups behind the notes, so a reader can weigh them. */
function Attribution({ sources, model }: { sources: string[]; model: string }) {
  return (
    <p className="mt-2 text-xs text-slate-400">
      {model}
      {sources.length > 0 && ` · from ${sources.join(', ')}`}
    </p>
  );
}
