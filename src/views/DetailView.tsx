import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useSearch } from '../context/SearchContext';
import { useUserData } from '../context/UserDataContext';
import { getListings, getCommute, getRating, geocode } from '../lib/dataClient';
import type { Listing, Rating as RatingType, Review, CommuteMode } from '../lib/types';
import MatchScore from '../components/MatchScore';
import Rating from '../components/Rating';
import Tag from '../components/Tag';
import SaveButton from '../components/SaveButton';
import ReviewForm from '../components/ReviewForm';
import { formatRent, formatBeds, resolveListingUrl, sourceLabel } from '../lib/format';

const ALL_MODES: CommuteMode[] = ['walk', 'transit', 'bike', 'drive'];

/**
 * Full listing detail: metadata, commute breakdown across ALL modes (not just
 * the preferred one), the blended rating + its source, first-party reviews, and
 * the outbound listing link. Pulls the scored entry from context when available
 * (so the match score matches the Results view) and lazily fetches the rest.
 */
export default function DetailView() {
  const { id } = useParams<{ id: string }>();
  const { results, criteria } = useSearch();
  const { getReviews, addReview, canWriteReviews } = useUserData();

  const fromResults = results.find((r) => r.listing.id === id);
  const [listing, setListing] = useState<Listing | null>(fromResults?.listing ?? null);
  const [matchScore] = useState<number | null>(fromResults?.matchScore ?? null);
  const [commutes, setCommutes] = useState<Record<CommuteMode, number> | null>(null);
  const [rating, setRating] = useState<RatingType | null>(
    fromResults
      ? { value: fromResults.listing.ratingValue, source: fromResults.listing.ratingSource }
      : null
  );
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [loading, setLoading] = useState(!fromResults);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!id) return;

      // If we didn't arrive from Results (e.g. deep link / refresh), fetch the listing.
      let l = listing;
      if (!l) {
        const all = await getListings({ city: '' });
        l = all.find((x) => x.id === id) ?? null;
        if (cancelled) return;
        setListing(l);
        if (l) {
          const r = await getRating(l);
          if (!cancelled) setRating(r);
        }
        setLoading(false);
      }
      if (!l) return;

      // Commute breakdown across all modes (only meaningful for in-person + an address).
      if (criteria.inPerson && criteria.workAddress) {
        const origin = await geocode(criteria.workAddress, criteria.city);
        const entries = await Promise.all(
          ALL_MODES.map(async (mode): Promise<[CommuteMode, number]> => {
            const c = await getCommute(origin, { lat: l!.lat, lng: l!.lng }, mode);
            return [mode, c.minutes];
          })
        );
        if (!cancelled) setCommutes(Object.fromEntries(entries) as Record<CommuteMode, number>);
      }

      const rv = await getReviews(id);
      if (!cancelled) setReviews(rv);
    }

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) {
    return <div className="h-64 animate-pulse rounded-2xl bg-slate-200" />;
  }

  if (!listing) {
    return (
      <div className="py-20 text-center">
        <h2 className="text-lg font-semibold text-slate-800">Listing not found</h2>
        <Link to="/results" className="mt-4 inline-block text-sm font-medium text-brand-600">
          ← Back to results
        </Link>
      </div>
    );
  }

  const { url, isFallback } = resolveListingUrl(listing);

  return (
    <div className="space-y-5">
      <Link to="/results" className="inline-flex items-center text-sm font-medium text-brand-600">
        ← Back to results
      </Link>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-slate-900">{listing.neighborhood}</h1>
            <p className="text-sm text-slate-500">
              {listing.address}, {listing.city}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <SaveButton id={listing.id} />
            {matchScore != null && <MatchScore score={matchScore} size="lg" />}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="Rent" value={formatRent(listing.rentMonthly)} />
          <Stat label="Size" value={formatBeds(listing.bedrooms)} />
          <Stat label="Source" value={sourceLabel(listing.source)} />
        </div>

        <div className="mt-4">
          <Rating
            value={rating?.value ?? listing.ratingValue}
            source={rating?.source ?? listing.ratingSource}
            showSource
            size="md"
          />
        </div>

        {listing.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {listing.tags.map((t) => (
              <Tag key={t}>{t}</Tag>
            ))}
          </div>
        )}

        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-base font-semibold text-white transition hover:bg-brand-700"
        >
          View listing on {sourceLabel(listing.source)}
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M7 17 17 7M9 7h8v8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
        {isFallback && (
          <p className="mt-2 text-center text-xs text-amber-600">
            The original listing link expired — this opens a search on the source site so you never hit a dead end.
          </p>
        )}
      </div>

      {/* Commute breakdown */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Commute to work</h2>
        {!criteria.inPerson ? (
          <p className="mt-2 text-sm text-slate-500">
            You searched as a remote worker, so commute isn't factored into your match.
          </p>
        ) : !criteria.workAddress ? (
          <p className="mt-2 text-sm text-slate-500">
            Add a work address on the search screen to see commute estimates.
          </p>
        ) : !commutes ? (
          <div className="mt-3 h-20 animate-pulse rounded-lg bg-slate-100" />
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {ALL_MODES.map((mode) => (
              <div
                key={mode}
                className={`rounded-lg border p-3 text-center ${
                  mode === criteria.commuteMode ? 'border-brand-300 bg-brand-50' : 'border-slate-200'
                }`}
              >
                <div className="text-lg font-bold text-slate-900">{commutes[mode]}</div>
                <div className="text-xs text-slate-500">min · {mode}</div>
              </div>
            ))}
          </div>
        )}
        {criteria.inPerson && criteria.workAddress && (
          <p className="mt-3 text-xs text-slate-400">
            From {criteria.workAddress}. Estimates are mocked in Phase 0; production uses TravelTime
            (transit-aware) with a Google Routes fallback.
          </p>
        )}
      </section>

      {/* Reviews */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Resident reviews</h2>
        {reviews == null ? (
          <div className="mt-3 h-16 animate-pulse rounded-lg bg-slate-100" />
        ) : reviews.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">
            No first-party reviews yet. Be the first when you move in.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {reviews.map((r) => (
              <li key={r.id} className="rounded-lg bg-slate-50 p-3">
                <div className="flex items-center gap-2">
                  <Rating value={r.stars} source={null} />
                  {r.livedHereVerified && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      ✓ Verified resident
                    </span>
                  )}
                </div>
                <p className="mt-1.5 text-sm text-slate-700">{r.text}</p>
              </li>
            ))}
          </ul>
        )}
        {canWriteReviews ? (
          <ReviewForm
            onSubmit={async (draft) => {
              const created = await addReview({ ...draft, listingId: listing.id });
              setReviews((prev) => [created, ...(prev ?? [])]);
            }}
          />
        ) : (
          <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
            Sign in to write a review for a place you’ve lived.
          </p>
        )}
        <p className="mt-3 text-xs text-slate-400">
          Ratings blend external sources with first-party reviews, weighting verified residents
          higher — and that weight grows as the platform does.
        </p>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-slate-900">{value}</div>
    </div>
  );
}
