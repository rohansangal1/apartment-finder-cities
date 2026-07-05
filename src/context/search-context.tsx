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
import { runSearch } from '../lib/search-service';

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

// ─────────────────────────────────────────────────────────────────────────
// Refresh persistence. React state lives only in memory, so a page refresh
// wipes the last search — losing results a user hadn't saved yet. We snapshot
// the completed search to sessionStorage and rehydrate it on load.
//
// Why sessionStorage (not localStorage): results are snapshots of *external*
// listings that go stale fast. sessionStorage survives refreshes and in-tab
// navigation but clears when the tab closes — the right lifetime for transient
// results. (Durable shortlisting is what "Save" + Supabase are for.) The `v1`
// key lets us invalidate old shapes if ScoredListing changes.
// ─────────────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'apt.lastSearch.v1';

interface PersistedSearch {
  criteria: SearchCriteria;
  results: ScoredListing[];
  hasSearched: boolean;
}

function loadPersisted(): PersistedSearch | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PersistedSearch) : null;
  } catch {
    // Storage disabled/unavailable (private mode, SSR) — just start fresh.
    return null;
  }
}

function savePersisted(snapshot: PersistedSearch): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Over quota or unavailable — non-fatal; the app still works this session.
  }
}

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
  // Rehydrate the last search from sessionStorage once, on mount (lazy init runs
  // the loader a single time). A restored search with results comes back 'ready'
  // so the Results view renders immediately instead of the empty state.
  const [initial] = useState<PersistedSearch | null>(loadPersisted);
  const [criteria, setCriteria] = useState<SearchCriteria>(initial?.criteria ?? DEFAULT_CRITERIA);
  const [results, setResults] = useState<ScoredListing[]>(initial?.results ?? []);
  const [status, setStatus] = useState<SearchStatus>(
    initial?.hasSearched && initial.results.length ? 'ready' : 'idle'
  );
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(initial?.hasSearched ?? false);

  const search = useCallback(async (nextCriteria: SearchCriteria) => {
    setCriteria(nextCriteria);
    setStatus('loading');
    setError(null);
    setHasSearched(true);
    try {
      const ranked = await runSearch(nextCriteria);
      setResults(ranked);
      setStatus('ready');
      // Snapshot the completed search so a refresh restores it.
      savePersisted({ criteria: nextCriteria, results: ranked, hasSearched: true });
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
