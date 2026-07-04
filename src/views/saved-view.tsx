import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useUserData } from '../context/user-data-context';
import { useAuth } from '../context/auth-context';
import { useSearch } from '../context/search-context';
import { toScoredFallback } from '../context/compare-context';
import Rating from '../components/rating';
import SaveButton from '../components/save-button';
import CompareToggle from '../components/compare-toggle';
import { formatRent, formatBeds, resolveListingUrl, STALE_AFTER_DAYS } from '../lib/format';

/**
 * Saved apartments. Renders directly from the snapshots stored at save time
 * (see UserDataContext → UserStore). Signed-in users read from Supabase (synced
 * across devices); guests read from localStorage on this device. No re-fetch is
 * needed because the full listing is captured when saved — listings are external
 * and ephemeral, so there's no reliable way to rehydrate them by id later.
 */
export default function SavedView() {
  const { savedListings } = useUserData();
  const { enabled, user } = useAuth();
  const { criteria } = useSearch();

  return (
    <div className="space-y-4">
      <header className="pt-2">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Saved apartments</h1>
        <p className="mt-1 text-sm text-slate-500">
          {enabled && user ? (
            'Your shortlist, synced to your account across all your devices.'
          ) : (
            <>
              Your shortlist, saved on this device.{' '}
              <Link to="/account" className="font-medium text-brand-600 hover:underline">
                Sign in
              </Link>{' '}
              to sync it across devices.
            </>
          )}
        </p>
      </header>

      {savedListings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <span className="text-4xl">🤍</span>
          <h2 className="mt-3 text-lg font-semibold text-slate-800">Nothing saved yet</h2>
          <p className="mt-1 max-w-xs text-sm text-slate-500">
            Tap the heart on any listing to add it here.
          </p>
          <Link
            to="/results"
            className="mt-5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Browse results
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {savedListings.map((s) => {
            const l = s.listing;
            // A saved snapshot doesn't re-validate; if it's been sitting in the
            // shortlist a while, treat it as possibly gone and route the link to a
            // search rather than a maybe-dead detail page.
            const stale =
              Date.now() - Date.parse(s.savedAt) > STALE_AFTER_DAYS * 24 * 60 * 60 * 1000;
            const { url } = resolveListingUrl(l, stale);
            return (
              <li
                key={l.id}
                className="rounded-2xl border border-slate-200 bg-ink p-4 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/listing/${l.id}`}
                      className="block truncate font-semibold text-slate-900 hover:text-brand-600"
                    >
                      {l.neighborhood}
                    </Link>
                    <p className="truncate text-sm text-slate-500">{l.address}</p>
                    {stale && (
                      <p className="mt-0.5 text-xs font-medium text-amber-600">
                        Saved a while ago — may no longer be available
                      </p>
                    )}
                    <div className="mt-1 flex items-center gap-2 text-sm text-slate-600">
                      <span className="font-semibold text-slate-900">{formatRent(l.rentMonthly)}</span>
                      <span className="text-slate-400">·</span>
                      <span>{formatBeds(l.bedrooms)}</span>
                    </div>
                    <div className="mt-1">
                      <Rating value={l.ratingValue} source={l.ratingSource} />
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <SaveButton listing={l} />
                    <CompareToggle entry={toScoredFallback(l, criteria)} />
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
                    >
                      View
                    </a>
                  </div>
                </div>
                <NoteEditor listingId={l.id} note={s.note} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * Inline private note for a saved listing. Collapsed to a one-line preview (or an
 * "Add a note" prompt); click to edit in a textarea; persists on blur. Works for
 * guests (localStorage) and signed-in users (Supabase) — same as saving.
 */
function NoteEditor({ listingId, note }: { listingId: string; note?: string }) {
  const { setNote } = useUserData();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note ?? '');

  const commit = () => {
    setEditing(false);
    const next = draft.trim();
    if (next !== (note ?? '')) setNote(listingId, next);
  };

  if (editing) {
    return (
      <textarea
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        rows={2}
        placeholder="Add a private note — great light, noisy street…"
        className="mt-3 w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-brand-300 focus:outline-none focus:ring-1 focus:ring-brand-200"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(note ?? '');
        setEditing(true);
      }}
      className="mt-3 block w-full rounded-lg bg-slate-50 px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-100"
    >
      {note ? (
        <span className="whitespace-pre-wrap">{note}</span>
      ) : (
        <span className="text-slate-400">+ Add a note</span>
      )}
    </button>
  );
}
