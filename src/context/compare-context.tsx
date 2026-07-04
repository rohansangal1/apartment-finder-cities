/**
 * CompareContext — a session-only shortlist (max 3) the user builds to compare
 * listings side by side. Deliberately not persisted: comparison is a transient,
 * in-the-moment task, and the entries are full ScoredListing snapshots that would
 * go stale. Mounted once in main.tsx so the tray and /compare view share state.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Listing, ScoredListing, SearchCriteria } from '../lib/types';
import { computeSubScores, scoreListing, explainMatch } from '../lib/scoring';

export const MAX_COMPARE = 3;

/**
 * Synthesize a ScoredListing for a saved snapshot so it can join listings that
 * came from a live search in the compare table. Reuses the same pure scoring
 * engine + the user's current criteria. Commute is unknown for a saved snapshot,
 * so we flag commuteApplies=false (the table shows N/A) rather than invent a
 * sub-score.
 */
export function toScoredFallback(listing: Listing, criteria: SearchCriteria): ScoredListing {
  const subScores = computeSubScores(listing, criteria, 0);
  const matchScore = scoreListing(listing, criteria, 0);
  return {
    listing,
    matchScore,
    commuteMinutes: 0,
    commuteMode: criteria.commuteMode,
    whyItMatched: explainMatch(subScores, criteria, listing),
    subScores,
    commuteApplies: false,
  };
}

interface CompareContextValue {
  entries: ScoredListing[];
  isSelected: (id: string) => boolean;
  isFull: boolean;
  /** Add if absent (when there's room), remove if already present. */
  toggle: (entry: ScoredListing) => void;
  remove: (id: string) => void;
  clear: () => void;
}

const CompareContext = createContext<CompareContextValue | null>(null);

export function CompareProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<ScoredListing[]>([]);

  const toggle = useCallback((entry: ScoredListing) => {
    setEntries((cur) => {
      if (cur.some((e) => e.listing.id === entry.listing.id)) {
        return cur.filter((e) => e.listing.id !== entry.listing.id);
      }
      if (cur.length >= MAX_COMPARE) return cur; // full — ignore
      return [...cur, entry];
    });
  }, []);

  const remove = useCallback((id: string) => {
    setEntries((cur) => cur.filter((e) => e.listing.id !== id));
  }, []);

  const clear = useCallback(() => setEntries([]), []);

  const value = useMemo<CompareContextValue>(
    () => ({
      entries,
      isSelected: (id) => entries.some((e) => e.listing.id === id),
      isFull: entries.length >= MAX_COMPARE,
      toggle,
      remove,
      clear,
    }),
    [entries, toggle, remove, clear]
  );

  return <CompareContext.Provider value={value}>{children}</CompareContext.Provider>;
}

export function useCompare(): CompareContextValue {
  const ctx = useContext(CompareContext);
  if (!ctx) throw new Error('useCompare must be used within <CompareProvider>');
  return ctx;
}
