/**
 * localStorage-backed UserStore — guest mode (no Supabase configured, or signed
 * out). Saved listings and preferences persist on the device; reviews fall back
 * to the mock dataClient for reads and are not writable (writing needs a real
 * identity, gated behind sign-in).
 */
import type { Review, NewReview, UserPreferences, SearchCriteria } from '../types';
import type { UserStore, SavedListing, SavedSearch } from './types';
import { getReviews as getMockReviews } from '../data-client';

// v2: entries are full SavedListing snapshots, not bare ids. The old v1 key
// (ids only) is intentionally not migrated — those can't be rehydrated anyway.
const SAVED_KEY = 'nestle.saved.v2';
const PREFS_KEY = 'nestle.prefs.v1';
const SEARCHES_KEY = 'nestle.searches.v1';

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage may be unavailable (private mode) — best effort */
  }
}

function readSaved(): SavedListing[] {
  return readJson<SavedListing[]>(SAVED_KEY, []);
}

export const localStore: UserStore = {
  async listSaved() {
    return readSaved();
  },

  async setSaved(listing, saved) {
    const existing = readSaved().find((r) => r.listing.id === listing.id);
    const rows = readSaved().filter((r) => r.listing.id !== listing.id);
    // Preserve any existing note if this is a re-save of the same listing.
    if (saved) rows.unshift({ listing, savedAt: new Date().toISOString(), note: existing?.note });
    writeJson(SAVED_KEY, rows);
  },

  async setNote(listingId, note) {
    const rows = readSaved().map((r) =>
      r.listing.id === listingId ? { ...r, note } : r
    );
    writeJson(SAVED_KEY, rows);
  },

  async getPreferences() {
    return readJson<UserPreferences | null>(PREFS_KEY, null);
  },

  async savePreferences(prefs) {
    writeJson(PREFS_KEY, prefs);
  },

  async getReviews(listingId) {
    // Guests see the same mock external reviews the rest of the prototype uses.
    return getMockReviews(listingId);
  },

  async addReview(_review: NewReview): Promise<Review> {
    throw new Error('Sign in to write a review.');
  },

  async listSearches() {
    return readJson<SavedSearch[]>(SEARCHES_KEY, []);
  },

  async saveSearch(name: string, criteria: SearchCriteria) {
    const entry: SavedSearch = {
      id: crypto.randomUUID(),
      name,
      criteria,
      createdAt: new Date().toISOString(),
    };
    writeJson(SEARCHES_KEY, [entry, ...readJson<SavedSearch[]>(SEARCHES_KEY, [])]);
    return entry;
  },

  async deleteSearch(id: string) {
    writeJson(
      SEARCHES_KEY,
      readJson<SavedSearch[]>(SEARCHES_KEY, []).filter((s) => s.id !== id)
    );
  },
};

/** Drop all local saves — used after merging a guest shortlist into an account. */
export function clearLocalSaved(): void {
  writeJson(SAVED_KEY, []);
}
