/**
 * App-wide search state: the user's criteria, the last results, and loading/error
 * status. Saved listings and preferences moved to UserDataContext in Phase 2.
 *
 * Keeping this in context means the Results and Detail views don't have to
 * re-run the search on navigation, and the Input view can pre-fill from the last
 * search (signed-in users get their saved defaults via UserDataContext).
 */
import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { SearchCriteria, ScoredListing } from '../lib/types';
import { runSearch } from '../lib/searchService';

export const DEFAULT_CRITERIA: SearchCriteria = {
  city: 'San Francisco',
  inPerson: true,
  workAddress: '',
  maxRent: 3500,
  bedrooms: 1,
  commuteMode: 'transit',
  weights: { commute: 0.7, price: 0.7, rating: 0.5, space: 0.4 },
};

type SearchStatus = 'idle' | 'loading' | 'ready' | 'error';

interface SearchContextValue {
  criteria: SearchCriteria;
  setCriteria: React.Dispatch<React.SetStateAction<SearchCriteria>>;
  results: ScoredListing[];
  status: SearchStatus;
  error: string | null;
  hasSearched: boolean;
  search: (nextCriteria: SearchCriteria) => Promise<void>;
}

const SearchContext = createContext<SearchContextValue | null>(null);

export function SearchProvider({ children }: { children: ReactNode }) {
  const [criteria, setCriteria] = useState<SearchCriteria>(DEFAULT_CRITERIA);
  const [results, setResults] = useState<ScoredListing[]>([]);
  const [status, setStatus] = useState<SearchStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const search = useCallback(async (nextCriteria: SearchCriteria) => {
    setCriteria(nextCriteria);
    setStatus('loading');
    setError(null);
    setHasSearched(true);
    try {
      const ranked = await runSearch(nextCriteria);
      setResults(ranked);
      setStatus('ready');
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'Something went wrong running your search.');
      setStatus('error');
    }
  }, []);

  const value: SearchContextValue = {
    criteria,
    setCriteria,
    results,
    status,
    error,
    hasSearched,
    search,
  };

  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>;
}

export function useSearch(): SearchContextValue {
  const ctx = useContext(SearchContext);
  if (!ctx) throw new Error('useSearch must be used within <SearchProvider>');
  return ctx;
}
