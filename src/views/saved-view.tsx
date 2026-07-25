import { lazy, Suspense, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useUserData } from '../context/user-data-context';
import { useAuth } from '../context/auth-context';
import { useSearch } from '../context/search-context';
import { toScoredFallback } from '../context/compare-context';

// Same lazy-loaded map the Results page uses — leaflet is ~150 kB, so it only
// loads when the user actually switches to the map tab.
const ResultsMap = lazy(() => import('../components/results-map'));
import Rating from '../components/rating';
import SaveButton from '../components/save-button';
import CompareToggle from '../components/compare-toggle';
import { formatRent, formatBeds } from '../lib/format';
import { resolveListingUrl, STALE_AFTER_DAYS } from '../lib/listing-links';
import ListingLinks from '../components/listing-links';
import AiNotesButton from '../components/ai-notes-button';
import DocumentSection from '../components/document-section';
import EmptyMark, { HeartGlyph } from '../components/empty-mark';

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
  const [view, setView] = useState<'list' | 'map'>('list');

  // Reuse the results scoring engine so saved snapshots can feed both the map and
  // the compare table. Saved items have no live commute, so toScoredFallback
  // marks commuteApplies=false (map/compare show N/A rather than a fake number).
  const scored = useMemo(
    () => savedListings.map((s) => toScoredFallback(s.listing, criteria)),
    [savedListings, criteria]
  );

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3 pt-2">
        <div>
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
        </div>
        {/* List/map toggle — mirrors the Results view. Only useful with places to show. */}
        {savedListings.length > 0 && (
          <div className="flex shrink-0 overflow-hidden rounded-lg border border-slate-200">
            {(['list', 'map'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                aria-pressed={view === v}
                className={`px-3 py-1.5 text-sm font-medium capitalize transition ${
                  view === v ? 'text-brand-600 shadow-[inset_0_0_0_1px_#9184d9]' : 'bg-ink text-slate-600 hover:text-slate-900'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        )}
      </header>

      {savedListings.length > 0 && view === 'map' ? (
        <Suspense
          fallback={<div className="h-[60vh] animate-pulse rounded-2xl bg-slate-200" />}
        >
          <ResultsMap scored={scored} />
        </Suspense>
      ) : savedListings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <EmptyMark size={110}>
            <HeartGlyph />
          </EmptyMark>
          <h2 className="mt-8 text-xl text-slate-900">Nothing saved yet</h2>
          <p className="mt-2.5 max-w-xs text-sm text-slate-500">
            Tap the heart on any listing to add it here.
          </p>
          <Link to="/results" className="btn-outline mt-6 px-6 py-3 text-[15px]">
            Browse results →
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
                className="card p-4"
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
                      className="btn-outline rounded-lg px-3 py-1.5 text-xs"
                    >
                      View
                    </a>
                  </div>
                </div>
                {/* Cross-check this saved place on other portals (StreetEasy /
                    Leasebreak appear only for NYC listings). */}
                <ListingLinks listing={l} isStale={stale} className="mt-2" />
                <NoteEditor listingId={l.id} note={s.note} />
                <AiNotesButton />
                <DocumentSection listingId={l.id} />
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
