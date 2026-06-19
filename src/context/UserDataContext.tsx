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
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import type { Review, NewReview, UserPreferences } from '../lib/types';
import type { UserStore } from '../lib/userData/types';
import { localStore } from '../lib/userData/localStore';
import { createSupabaseStore } from '../lib/userData/supabaseStore';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

interface UserDataContextValue {
  savedIds: Set<string>;
  isSaved: (id: string) => boolean;
  toggleSaved: (id: string) => Promise<void>;
  canWriteReviews: boolean;
  getReviews: (listingId: string) => Promise<Review[]>;
  addReview: (review: NewReview) => Promise<Review>;
  getPreferences: () => Promise<UserPreferences | null>;
  savePreferences: (prefs: UserPreferences) => Promise<void>;
}

const UserDataContext = createContext<UserDataContextValue | null>(null);

export function UserDataProvider({ children }: { children: ReactNode }) {
  const { user, enabled } = useAuth();

  // Choose the backing store whenever auth changes.
  const store: UserStore = useMemo(() => {
    if (enabled && supabase && user) return createSupabaseStore(supabase, user);
    return localStore;
  }, [enabled, user]);

  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  // Load saved IDs from the active store (re-runs on sign-in/out).
  useEffect(() => {
    let cancelled = false;
    store
      .listSavedIds()
      .then((ids) => {
        if (!cancelled) setSavedIds(new Set(ids));
      })
      .catch((e) => console.error('Failed to load saved listings', e));
    return () => {
      cancelled = true;
    };
  }, [store]);

  const toggleSaved = useCallback(
    async (id: string) => {
      const willSave = !savedIds.has(id);
      // Optimistic update for a responsive heart toggle.
      setSavedIds((prev) => {
        const next = new Set(prev);
        if (willSave) next.add(id);
        else next.delete(id);
        return next;
      });
      try {
        await store.setSaved(id, willSave);
      } catch (e) {
        console.error('Failed to update saved listing', e);
        // Roll back on failure.
        setSavedIds((prev) => {
          const next = new Set(prev);
          if (willSave) next.delete(id);
          else next.add(id);
          return next;
        });
      }
    },
    [store, savedIds]
  );

  // Stable identities tied to the active store, so consumers' effects only
  // re-run when the store actually changes (i.e. on sign-in/out), not every render.
  const getReviews = useCallback((listingId: string) => store.getReviews(listingId), [store]);
  const addReview = useCallback((review: NewReview) => store.addReview(review), [store]);
  const getPreferences = useCallback(() => store.getPreferences(), [store]);
  const savePreferences = useCallback(
    (prefs: UserPreferences) => store.savePreferences(prefs),
    [store]
  );

  const value: UserDataContextValue = {
    savedIds,
    isSaved: (id) => savedIds.has(id),
    toggleSaved,
    canWriteReviews: enabled && Boolean(user),
    getReviews,
    addReview,
    getPreferences,
    savePreferences,
  };

  return <UserDataContext.Provider value={value}>{children}</UserDataContext.Provider>;
}

export function useUserData(): UserDataContextValue {
  const ctx = useContext(UserDataContext);
  if (!ctx) throw new Error('useUserData must be used within <UserDataProvider>');
  return ctx;
}
