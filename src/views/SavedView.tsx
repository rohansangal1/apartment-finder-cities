import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useUserData } from '../context/UserDataContext';
import { getListings, getRating } from '../lib/dataClient';
import type { Listing } from '../lib/types';
import Rating from '../components/Rating';
import SaveButton from '../components/SaveButton';
import { formatRent, formatBeds, resolveListingUrl } from '../lib/format';

/**
 * Saved apartments. Stub for now: persists IDs to localStorage and rehydrates
 * the listing metadata via the dataClient. Phase 2 swaps localStorage for the
 * `saved_listings` table behind Supabase auth (gated by a sign-in check).
 */
export default function SavedView() {
  const { savedIds } = useUserData();
  const [listings, setListings] = useState<Listing[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const all = await getListings({ city: '' });
      const mine = all.filter((l) => savedIds.has(l.id));
      const withRatings = await Promise.all(
        mine.map(async (l): Promise<Listing> => {
          const r = await getRating(l);
          return { ...l, ratingValue: r.value, ratingSource: r.source };
        })
      );
      if (!cancelled) setListings(withRatings);
    })();
    return () => {
      cancelled = true;
    };
  }, [savedIds]);

  return (
    <div className="space-y-4">
      <header className="pt-2">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Saved apartments</h1>
        <p className="mt-1 text-sm text-slate-500">
          Your shortlist. Sign in (coming soon) to keep it synced across devices.
        </p>
      </header>

      {listings == null ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-200" />
          ))}
        </div>
      ) : listings.length === 0 ? (
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
          {listings.map((l) => {
            const { url } = resolveListingUrl(l);
            return (
              <li
                key={l.id}
                className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/listing/${l.id}`}
                    className="block truncate font-semibold text-slate-900 hover:text-brand-600"
                  >
                    {l.neighborhood}
                  </Link>
                  <p className="truncate text-sm text-slate-500">{l.address}</p>
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
                  <SaveButton id={l.id} />
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
                  >
                    View
                  </a>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
