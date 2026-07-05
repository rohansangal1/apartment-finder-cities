/**
 * UserStore — the single interface for per-user persistence (saved listings,
 * default preferences, first-party reviews). Two implementations satisfy it:
 *
 *   localStore   — browser localStorage; guest mode / no Supabase configured.
 *   supabaseStore — Postgres behind Supabase Auth + RLS; the real Phase 2 store.
 *
 * UserDataContext picks the implementation based on auth state, so components
 * never branch on "are we signed in" for storage — they just call the store.
 */
import type { Listing, Review, NewReview, UserPreferences, SearchCriteria } from '../types';

/** A shortlisted listing: the full snapshot captured at save time + when. */
export interface SavedListing {
  listing: Listing;
  savedAt: string;
  /** Optional private note the user attached to this saved listing. */
  note?: string;
}

/** A named, re-runnable search — the full SearchCriteria snapshot + when saved. */
export interface SavedSearch {
  id: string;
  name: string;
  criteria: SearchCriteria;
  createdAt: string;
}

/** A reusable work address the user can pick instead of retyping it each search.
 * `label` is a friendly name ("Office", "Downtown campus"); `address` is the
 * full string fed to the commute geocoder. */
export interface SavedAddress {
  id: string;
  label: string;
  address: string;
  createdAt: string;
}

export interface UserStore {
  /** Full snapshots, most-recently-saved first. */
  listSaved(): Promise<SavedListing[]>;
  /** Save requires the full listing (snapshot); unsave keys off listing.id. */
  setSaved(listing: Listing, saved: boolean): Promise<void>;
  /** Attach/replace the private note on an already-saved listing. */
  setNote(listingId: string, note: string): Promise<void>;

  getPreferences(): Promise<UserPreferences | null>;
  savePreferences(prefs: UserPreferences): Promise<void>;

  getReviews(listingId: string): Promise<Review[]>;
  addReview(review: NewReview): Promise<Review>;

  /** Named, re-runnable searches (most-recently-saved first). */
  listSearches(): Promise<SavedSearch[]>;
  saveSearch(name: string, criteria: SearchCriteria): Promise<SavedSearch>;
  deleteSearch(id: string): Promise<void>;

  /** Reusable work addresses (most-recently-saved first). */
  listAddresses(): Promise<SavedAddress[]>;
  saveAddress(label: string, address: string): Promise<SavedAddress>;
  deleteAddress(id: string): Promise<void>;
}
