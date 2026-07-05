/**
 * UserDataContext — saved listings, default preferences, and first-party reviews
 * for the current user. Picks the storage backend from auth state:
 *   signed in + Supabase → supabaseStore (per-user, RLS-protected)
 *   otherwise            → localStore (guest mode on this device)
 *
 * Components call these methods without knowing which backend is active — that's
 * the whole point. Saved IDs are mirrored into local state for snappy toggles.
 */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import type { Listing, Review, NewReview, UserPreferences, SearchCriteria } from '../lib/types';
import type { UserStore, SavedListing, SavedSearch } from '../lib/user-data/types';
import { localStore, clearLocalSaved } from '../lib/user-data/local-store';
import { createSupabaseStore } from '../lib/user-data/supabase-store';
import { supabase } from '../lib/supabase';
import { useAuth } from './auth-context';

interface UserDataContextValue {
  savedListings: SavedListing[];
  savedIds: Set<string>;
  isSaved: (id: string) => boolean;
  toggleSaved: (listing: Listing) => Promise<void>;
  setNote: (listingId: string, note: string) => Promise<void>;
  canWriteReviews: boolean;
  getReviews: (listingId: string) => Promise<Review[]>;
  addReview: (review: NewReview) => Promise<Review>;
  getPreferences: () => Promise<UserPreferences | null>;
  savePreferences: (prefs: UserPreferences) => Promise<void>;
  savedSearches: SavedSearch[];
  saveSearch: (name: string, criteria: SearchCriteria) => Promise<SavedSearch>;
  deleteSearch: (id: string) => Promise<void>;
}

const UserDataContext = createContext<UserDataContextValue | null>(null);

export function UserDataProvider({ children }: { children: ReactNode }) {
  const { user, enabled } = useAuth();

  // Choose the backing store whenever auth changes.
  const store: UserStore = useMemo(() => {
    if (enabled && supabase && user) return createSupabaseStore(supabase, user);
    return localStore;
  }, [enabled, user]);

  const [savedListings, setSavedListings] = useState<SavedListing[]>([]);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const savedIds = useMemo(
    () => new Set(savedListings.map((s) => s.listing.id)),
    [savedListings]
  );

  // Whether we've already merged this signed-in user's guest shortlist. Reset
  // whenever the store changes (e.g. sign-out) so the next sign-in merges again.
  const mergedRef = useRef(false);

  // Load saved snapshots from the active store (re-runs on sign-in/out). When a
  // guest signs in, first push any local shortlist into the account, then clear
  // it locally so the two don't diverge.
  useEffect(() => {
    let cancelled = false;
    const usingAccount = store !== localStore;
    (async () => {
      try {
        if (usingAccount && !mergedRef.current) {
          mergedRef.current = true;
          const local = await localStore.listSaved();
          if (local.length) {
            await Promise.all(local.map((s) => store.setSaved(s.listing, true)));
            clearLocalSaved();
          }
        } else if (!usingAccount) {
          mergedRef.current = false;
        }
        const saved = await store.listSaved();
        if (!cancelled) setSavedListings(saved);
      } catch (e) {
        console.error('Failed to load saved listings', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [store]);

  // Load saved searches from the active store (re-runs on sign-in/out). Fails
  // soft: if the saved_searches table isn't migrated yet, we just show none.
  useEffect(() => {
    let cancelled = false;
    store
      .listSearches()
      .then((s) => {
        if (!cancelled) setSavedSearches(s);
      })
      .catch((e) => console.error('Failed to load saved searches', e));
    return () => {
      cancelled = true;
    };
  }, [store]);

  const toggleSaved = useCallback(
    async (listing: Listing) => {
      const willSave = !savedIds.has(listing.id);
      // Optimistic update for a responsive heart toggle.
      const prev = savedListings;
      setSavedListings((cur) => {
        const without = cur.filter((s) => s.listing.id !== listing.id);
        return willSave
          ? [{ listing, savedAt: new Date().toISOString() }, ...without]
          : without;
      });
      try {
        await store.setSaved(listing, willSave);
      } catch (e) {
        console.error('Failed to update saved listing', e);
        setSavedListings(prev); // Roll back on failure.
      }
    },
    [store, savedIds, savedListings]
  );

  const setNote = useCallback(
    async (listingId: string, note: string) => {
      // Optimistic: patch the note locally, roll back if the write fails.
      const prev = savedListings;
      setSavedListings((cur) =>
        cur.map((s) => (s.listing.id === listingId ? { ...s, note } : s))
      );
      try {
        await store.setNote(listingId, note);
      } catch (e) {
        console.error('Failed to save note', e);
        setSavedListings(prev);
      }
    },
    [store, savedListings]
  );

  // Stable identities tied to the active store, so consumers' effects only
  // re-run when the store actually changes (i.e. on sign-in/out), not every render.
  const saveSearch = useCallback(
    async (name: string, criteria: SearchCriteria) => {
      const created = await store.saveSearch(name, criteria);
      setSavedSearches((cur) => [created, ...cur]);
      return created;
    },
    [store]
  );

  const deleteSearch = useCallback(
    async (id: string) => {
      const prev = savedSearches;
      setSavedSearches((cur) => cur.filter((s) => s.id !== id)); // optimistic
      try {
        await store.deleteSearch(id);
      } catch (e) {
        console.error('Failed to delete saved search', e);
        setSavedSearches(prev); // roll back
      }
    },
    [store, savedSearches]
  );

  const getReviews = useCallback((listingId: string) => store.getReviews(listingId), [store]);
  const addReview = useCallback((review: NewReview) => store.addReview(review), [store]);
  const getPreferences = useCallback(() => store.getPreferences(), [store]);
  const savePreferences = useCallback(
    (prefs: UserPreferences) => store.savePreferences(prefs),
    [store]
  );

  const value: UserDataContextValue = {
    savedListings,
    savedIds,
    isSaved: (id) => savedIds.has(id),
    toggleSaved,
    setNote,
    canWriteReviews: enabled && Boolean(user),
    getReviews,
    addReview,
    getPreferences,
    savePreferences,
    savedSearches,
    saveSearch,
    deleteSearch,
  };

  return <UserDataContext.Provider value={value}>{children}</UserDataContext.Provider>;
}

export function useUserData(): UserDataContextValue {
  const ctx = useContext(UserDataContext);
  if (!ctx) throw new Error('useUserData must be used within <UserDataProvider>');
  return ctx;
}
