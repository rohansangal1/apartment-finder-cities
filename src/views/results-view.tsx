import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useSearch } from '../context/search-context';
import { useUserData } from '../context/user-data-context';
import { useMediaQuery } from '../lib/use-media-query';
import type { ScoredListing, SearchCriteria } from '../lib/types';
import { SORTERS } from '../lib/search-service';
import ListingCard from '../components/listing-card';
import ListingSkeleton from '../components/listing-skeleton';
import CompareToggle from '../components/compare-toggle';
import ResultsFilters, {
  EMPTY_FILTERS,
  matchesFilters,
  type ResultFilters,
} from '../components/results-filters';

// Leaflet is heavy (~150 kB) and only needed when the user opens the map, so
// load it on demand to keep the initial bundle lean.
const ResultsMap = lazy(() => import('../components/results-map'));

const SORT_OPTIONS = [
  { value: 'match', label: 'Best match' },
  { value: 'price', label: 'Lowest price' },
  { value: 'truecost', label: 'Cheapest all-in' },
  { value: 'commute', label: 'Shortest commute' },
];

/** Ranked recommendations with a sort toggle. */
export default function ResultsView() {
  const { results, status, error, hasSearched, criteria } = useSearch();
  const { saveSearch } = useUserData();
  const [sort, setSort] = useState('match');
  const [view, setView] = useState<'list' | 'map'>('list');
  const [filters, setFilters] = useState<ResultFilters>(EMPTY_FILTERS);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // ≥1024px gets a permanent split list+map instead of the mobile list/map toggle.
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  // Card element refs, so a map pin hover can scroll its card into view.
  const cardRefs = useRef(new Map<string, HTMLDivElement>());

  // A fresh search invalidates the old refinements — start clean each result set.
  useEffect(() => {
    setFilters(EMPTY_FILTERS);
  }, [results]);

  const sorted = useMemo(() => {
    // Refine first (client-side narrowing of the ranked set), then sort. Commute
    // sort is meaningless for remote searches; fall back to match.
    const sorter = sort === 'commute' && !criteria.inPerson ? SORTERS.match : SORTERS[sort];
    return results.filter((s) => matchesFilters(s, filters)).sort(sorter);
  }, [results, sort, criteria.inPerson, filters]);

  // A map pin hover/click highlights and scrolls the matching card into view.
  const handleMapSelect = (id: string) => {
    setHoveredId(id);
    cardRefs.current.get(id)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  if (!hasSearched) {
    return (
      <EmptyState
        title="No search yet"
        body="Tell us your situation and we'll rank the best-fit apartments."
        cta
      />
    );
  }

  if (status === 'loading') return <LoadingState />;

  if (status === 'error') {
    return (
      <EmptyState title="Something went wrong" body={error || 'Please try your search again.'} cta />
    );
  }

  if (results.length === 0) {
    return (
      <EmptyState
        title="No matches found"
        body={`We don't have listings for ${criteria.city} yet. Try another city or widen your budget.`}
        cta
      />
    );
  }

  return (
    <div>
      <div className="sticky top-[57px] z-10 -mx-4 mb-3 flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/95 px-4 py-2.5 backdrop-blur">
        <div>
          <h1 className="text-lg font-bold text-slate-900">
            {sorted.length === results.length
              ? `${results.length} matches in ${criteria.city}`
              : `${sorted.length} of ${results.length} matches`}
          </h1>
          <p className="text-xs text-slate-500">
            {criteria.inPerson
              ? 'Ranked by your priorities + commute'
              : 'Ranked by your priorities'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <SaveSearchButton
            onSave={() => saveSearch(searchName(criteria), criteria)}
          />
          {(isDesktop || view === 'list') && (
            <label>
              <span className="sr-only">Sort by</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="rounded-lg border border-slate-200 bg-ink px-2.5 py-1.5 text-sm font-medium text-slate-700 shadow-sm"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {/* The split view replaces the toggle on desktop. */}
          {!isDesktop && (
            <div className="flex overflow-hidden rounded-lg border border-slate-200">
              {(['list', 'map'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  aria-pressed={view === v}
                  className={`px-2.5 py-1.5 text-sm font-medium capitalize transition ${
                    view === v ? 'bg-brand-600 text-white' : 'bg-ink text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {(isDesktop || view === 'list') && (
        <ResultsFilters results={results} filters={filters} onChange={setFilters} />
      )}

      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center motion-safe:animate-fadeup">
          <h2 className="font-serif text-xl font-semibold text-slate-900">No matches with these filters</h2>
          <p className="mt-1 max-w-xs text-sm text-slate-500">
            Nothing in {criteria.city} fits every refinement. Loosen one to see more.
          </p>
          <button
            type="button"
            onClick={() => setFilters(EMPTY_FILTERS)}
            className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Clear filters
          </button>
        </div>
      ) : isDesktop ? (
        // Split: scrolling list on the left, sticky map on the right. The map is
        // only mounted here (desktop) or in mobile map view, so leaflet stays lazy.
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,44%)]">
          <div>{renderList(sorted, criteria, cardRefs, setHoveredId, hoveredId)}</div>
          <div>
            <div className="sticky top-[105px]">
              <Suspense
                fallback={<div className="h-[calc(100vh-130px)] animate-pulse rounded-2xl bg-slate-200" />}
              >
                <ResultsMap
                  scored={sorted}
                  highlightedId={hoveredId ?? undefined}
                  onSelect={handleMapSelect}
                  className="h-[calc(100vh-130px)]"
                />
              </Suspense>
            </div>
          </div>
        </div>
      ) : view === 'map' ? (
        <Suspense
          fallback={<div className="h-[60vh] animate-pulse rounded-2xl bg-slate-200" />}
        >
          <ResultsMap scored={sorted} highlightedId={hoveredId ?? undefined} onSelect={handleMapSelect} />
        </Suspense>
      ) : (
        renderList(sorted, criteria, cardRefs, setHoveredId, hoveredId)
      )}

      <div className="mt-6 text-center">
        <Link to="/" className="text-sm font-medium text-brand-600 hover:text-brand-700">
          ← Adjust your search
        </Link>
      </div>
    </div>
  );
}

/** The staggered card list, shared by the mobile list view and the desktop split.
 * Each card registers its element so a map-pin hover can scroll it into view, and
 * gets a brand ring while its pin is the active one. */
function renderList(
  sorted: ScoredListing[],
  criteria: SearchCriteria,
  cardRefs: { current: Map<string, HTMLDivElement> },
  onHover: (id: string | null) => void,
  hoveredId: string | null
) {
  return (
    <div className="space-y-3">
      {sorted.map((scored, i) => (
        <div
          key={scored.listing.id}
          ref={(el) => {
            if (el) cardRefs.current.set(scored.listing.id, el);
            else cardRefs.current.delete(scored.listing.id);
          }}
          className="motion-safe:animate-fadeup"
          style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}
        >
          <ListingCard
            scored={scored}
            inPerson={criteria.inPerson}
            monthlyIncome={criteria.monthlyIncome}
            onHover={onHover}
            highlighted={hoveredId === scored.listing.id}
            compareSlot={<CompareToggle entry={scored} />}
          />
        </div>
      ))}
    </div>
  );
}

/** A short human label for a saved search, e.g. "San Francisco · 1BR · ≤$3,500". */
function searchName(criteria: SearchCriteria): string {
  const beds = criteria.bedrooms === 0 ? 'Studio' : `${criteria.bedrooms}BR`;
  return `${criteria.city} · ${beds} · ≤$${criteria.maxRent.toLocaleString()}`;
}

/** "Save search" button with brief saved/failed feedback. Available to guests
 * (localStorage) and signed-in users (synced); fails soft if the store errors. */
function SaveSearchButton({ onSave }: { onSave: () => Promise<unknown> }) {
  const [state, setState] = useState<'idle' | 'saved' | 'error'>('idle');
  const click = async () => {
    try {
      await onSave();
      setState('saved');
    } catch {
      setState('error');
    }
    setTimeout(() => setState('idle'), 2200);
  };
  return (
    <button
      type="button"
      onClick={click}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-ink px-2.5 py-1.5 text-sm font-medium text-slate-700 transition hover:text-slate-900"
    >
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
        <path d="M17 21v-8H7v8M7 3v5h8" />
      </svg>
      {state === 'saved' ? 'Saved' : state === 'error' ? 'Try again' : 'Save search'}
    </button>
  );
}

function LoadingState() {
  return (
    <div className="space-y-3 pt-2">
      <div className="h-6 w-48 animate-pulse rounded bg-ink-700" />
      {[0, 1, 2].map((i) => (
        <ListingSkeleton key={i} />
      ))}
    </div>
  );
}

function EmptyState({ title, body, cta }: { title: string; body: ReactNode; cta?: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center motion-safe:animate-fadeup">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sage text-brand-700">
        <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9.5 12 3l9 6.5" />
          <path d="M5 9v11h14V9" />
          <path d="M9 20v-6h6v6" />
        </svg>
      </span>
      <h2 className="mt-4 font-serif text-2xl font-semibold text-slate-900">{title}</h2>
      <p className="mt-1 max-w-xs text-sm text-slate-500">{body}</p>
      {cta && (
        <Link
          to="/"
          className="mt-5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Start a search
        </Link>
      )}
    </div>
  );
}
