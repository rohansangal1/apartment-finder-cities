/**
 * localStorage-backed UserStore — guest mode (no Supabase configured, or signed
 * out). Saved listings and preferences persist on the device; reviews fall back
 * to the mock dataClient for reads and are not writable (writing needs a real
 * identity, gated behind sign-in).
 */
import type { Review, NewReview, UserPreferences } from '../types';
import type { UserStore } from './types';
import { getReviews as getMockReviews } from '../dataClient';

const SAVED_KEY = 'nestle.saved.v1';
const PREFS_KEY = 'nestle.prefs.v1';

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

export const localStore: UserStore = {
  async listSavedIds() {
    return readJson<string[]>(SAVED_KEY, []);
  },

  async setSaved(listingId, saved) {
    const ids = new Set(readJson<string[]>(SAVED_KEY, []));
    if (saved) ids.add(listingId);
    else ids.delete(listingId);
    writeJson(SAVED_KEY, [...ids]);
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
};
