/**
 * Shared data model for the whole app. These mirror the canonical spec exactly.
 * The UI, scoring engine, and dataClient all speak in terms of these types.
 */

export type Source = 'rentcast' | 'apartments_com' | 'zillow' | 'mock';

export interface Listing {
  id: string;
  source: Source;
  listingUrl: string; // deep link out to the source site
  address: string;
  neighborhood: string;
  city: string;
  lat: number;
  lng: number;
  rentMonthly: number;
  bedrooms: number;
  tags: string[]; // e.g. ['pet-friendly', 'in-unit laundry']
  ratingValue: number | null;
  ratingSource: string; // e.g. 'google', 'platform-users', 'aggregated'
}

export type CommuteMode = 'walk' | 'transit' | 'bike' | 'drive';

/** User priorities, each 0–1, normalized before scoring. */
export interface Weights {
  commute: number;
  price: number;
  rating: number;
  space: number;
}

export interface SearchCriteria {
  city: string;
  inPerson: boolean;
  workAddress?: string;
  maxRent: number;
  bedrooms: number;
  commuteMode: CommuteMode;
  weights: Weights;
}

/** First-party reviews — exist from day one (cold-start handoff). */
export interface Review {
  id: string;
  listingId: string;
  userId: string;
  stars: number; // 1–5
  text: string;
  livedHereVerified: boolean; // true if they found the place via the platform
  createdAt: string;
}

export interface Commute {
  minutes: number;
  mode: CommuteMode;
}

export interface Rating {
  value: number | null;
  source: string;
}

export interface GeoPoint {
  lat: number;
  lng: number;
}

/** The four 0–100 sub-scores that combine into a match score. */
export interface SubScores {
  commute: number;
  price: number;
  rating: number;
  space: number;
}

/** A scored listing as consumed by the Results/Detail views. */
export interface ScoredListing {
  listing: Listing;
  matchScore: number; // 0–100
  commuteMinutes: number;
  commuteMode: CommuteMode;
  whyItMatched: string;
  subScores: SubScores;
}

/**
 * Persisted per-user default search preferences (Phase 2). A subset of
 * SearchCriteria so returning, signed-in users skip re-entering their situation.
 */
export interface UserPreferences {
  homeCity?: string;
  workAddress?: string;
  commuteMode?: CommuteMode;
  weights?: Weights;
}

/** A review as submitted by a user, before the store assigns id/createdAt. */
export interface NewReview {
  listingId: string;
  stars: number;
  text: string;
  livedHereVerified: boolean;
}

/** The interface every dataClient implementation (mock now, api later) satisfies. */
export interface DataClient {
  getListings(criteria: Partial<SearchCriteria>): Promise<Listing[]>;
  getCommute(origin: GeoPoint, destination: GeoPoint, mode: CommuteMode): Promise<Commute>;
  getRating(building: Listing): Promise<Rating>;
  geocode(address: string, cityHint?: string): Promise<GeoPoint>;
  getReviews(listingId: string): Promise<Review[]>;
}
