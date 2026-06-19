/**
 * API implementation of the DataClient interface (Phase 1).
 *
 * Same methods as mockClient, but each one calls a key-protected serverless
 * function under /api instead of using in-browser fixtures. Selected when
 * VITE_DATA_SOURCE=api. The UI is unchanged — this file IS the swap.
 *
 * Note: getListings here returns metadata only; the full search (with commute +
 * ratings + scoring) goes through runSearch → but since the heavy orchestration
 * lives server-side at POST /api/search, searchService could alternatively call
 * that directly. We keep the per-method shape so progressive hydration and the
 * existing searchService both work without changes.
 */
import type {
  Listing,
  SearchCriteria,
  Commute,
  Rating,
  GeoPoint,
  CommuteMode,
  Review,
  DataClient,
  ScoredListing,
} from '../types';

const BASE = import.meta.env?.VITE_API_BASE_URL || '';

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error((await errorMessage(res)) || `Request failed: ${res.status}`);
  return (await res.json()) as T;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await errorMessage(res)) || `Request failed: ${res.status}`);
  return (await res.json()) as T;
}

async function errorMessage(res: Response): Promise<string | null> {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error ?? null;
  } catch {
    return null;
  }
}

/**
 * Run the full server-side search in one round-trip. searchService doesn't call
 * this directly (it composes the per-method calls below), but it's exported so a
 * future optimization can short-circuit to the orchestration endpoint.
 */
export async function search(criteria: SearchCriteria): Promise<ScoredListing[]> {
  const { results } = await postJson<{ results: ScoredListing[] }>('/api/search', criteria);
  return results;
}

export async function getListings(criteria: Partial<SearchCriteria>): Promise<Listing[]> {
  // The orchestration endpoint returns scored listings; for the per-method
  // contract we hand back just the listing metadata and let the scorer re-run.
  const { results } = await postJson<{ results: ScoredListing[] }>('/api/search', criteria);
  return results.map((r) => r.listing);
}

export async function getCommute(
  origin: GeoPoint,
  destination: GeoPoint,
  mode: CommuteMode
): Promise<Commute> {
  const params = new URLSearchParams({
    originLat: String(origin.lat),
    originLng: String(origin.lng),
    destLat: String(destination.lat),
    destLng: String(destination.lng),
    mode,
  });
  return getJson<Commute>(`/api/commute?${params}`);
}

export async function getRating(building: Listing): Promise<Rating> {
  const params = new URLSearchParams({ address: building.address, city: building.city });
  return getJson<Rating>(`/api/rating?${params}`);
}

export async function geocode(address: string): Promise<GeoPoint> {
  return getJson<GeoPoint>(`/api/geocode?address=${encodeURIComponent(address)}`);
}

export async function getReviews(_listingId: string): Promise<Review[]> {
  // First-party reviews land in Phase 2 (Supabase). No endpoint yet.
  return [];
}

export const apiClient: DataClient = {
  getListings,
  getCommute,
  getRating,
  geocode,
  getReviews,
};
