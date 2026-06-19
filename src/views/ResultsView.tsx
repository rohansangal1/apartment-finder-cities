import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useSearch } from '../context/SearchContext';
import { SORTERS } from '../lib/searchService';
import ListingCard from '../components/ListingCard';

const SORT_OPTIONS = [
  { value: 'match', label: 'Best match' },
  { value: 'price', label: 'Lowest price' },
  { value: 'commute', label: 'Shortest commute' },
];

/** Ranked recommendations with a sort toggle. */
export default function ResultsView() {
  const { results, status, error, hasSearched, criteria } = useSearch();
  const [sort, setSort] = useState('match');

  const sorted = useMemo(() => {
    const arr = [...results];
    // Commute sort is meaningless for remote searches; fall back to match.
    const sorter = sort === 'commute' && !criteria.inPerson ? SORTERS.match : SORTERS[sort];
    return arr.sort(sorter);
  }, [results, sort, criteria.inPerson]);

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

  if (sorted.length === 0) {
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
            {sorted.length} matches in {criteria.city}
          </h1>
          <p className="text-xs text-slate-500">
            {criteria.inPerson
              ? 'Ranked by your priorities + commute'
              : 'Ranked by your priorities'}
          </p>
        </div>
        <label className="shrink-0">
          <span className="sr-only">Sort by</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-700 shadow-sm"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="space-y-3">
        {sorted.map((scored) => (
          <ListingCard key={scored.listing.id} scored={scored} inPerson={criteria.inPerson} />
        ))}
      </div>

      <div className="mt-6 text-center">
        <Link to="/" className="text-sm font-medium text-brand-600 hover:text-brand-700">
          ← Adjust your search
        </Link>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-3 pt-2">
      <div className="h-6 w-48 animate-pulse rounded bg-slate-200" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-40 animate-pulse rounded-2xl bg-slate-200" />
      ))}
    </div>
  );
}

function EmptyState({ title, body, cta }: { title: string; body: ReactNode; cta?: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
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
