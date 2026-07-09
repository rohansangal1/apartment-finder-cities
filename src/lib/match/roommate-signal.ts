/**
 * Roommate matching — the pure, privacy-preserving core.
 *
 * Two pure functions, no network or DOM, shared verbatim between the browser
 * (which builds a user's signal from their saved snapshots) and the server
 * (which compares signals to score candidates):
 *
 *   buildRoommateSignal(saved) -> coarse buckets ONLY (cities, budget band, bed
 *     counts, neighborhoods). Deliberately lossy: it never carries an exact
 *     address, a listing id, or a private note off the owner's device/row.
 *
 *   roommateSimilarity(a, b) -> 0–100, set-overlap (Jaccard) over the shared
 *     buckets, combined by fixed weights. Same normalize→weight→combine shape as
 *     scoring.ts, so the number reads on the same 0–100 scale as a match score.
 */
import type { Listing } from '../types.js';

/** The only thing ever compared across users. Coarse by design. */
export interface RoommateSignal {
  /** Distinct cities the user has saved in. */
  cities: string[];
  /** Distinct neighborhoods the user has saved in. */
  neighborhoods: string[];
  /** Distinct bedroom counts across saves. */
  bedCounts: number[];
  /** [min, max] monthly rent band across saves, rounded to the nearest $100. */
  budgetBand: [number, number] | null;
}

/** Round to the nearest $100 so the band is a coarse bucket, not an exact figure. */
const roundHundred = (n: number) => Math.round(n / 100) * 100;

const uniq = <T>(xs: T[]): T[] => Array.from(new Set(xs));

/** Build the shareable signal from a user's saved listings (snapshots). */
export function buildRoommateSignal(listings: Listing[]): RoommateSignal {
  const cities = uniq(listings.map((l) => l.city).filter(Boolean));
  const neighborhoods = uniq(listings.map((l) => l.neighborhood).filter(Boolean));
  const bedCounts = uniq(listings.map((l) => l.bedrooms)).sort((a, b) => a - b);
  const rents = listings.map((l) => l.rentMonthly).filter((r) => r > 0);
  const budgetBand: [number, number] | null = rents.length
    ? [roundHundred(Math.min(...rents)), roundHundred(Math.max(...rents))]
    : null;
  return { cities, neighborhoods, bedCounts, budgetBand };
}

/** Jaccard overlap of two sets: |A∩B| / |A∪B|, 0 when both are empty. */
function jaccard<T>(a: T[], b: T[]): number {
  if (!a.length && !b.length) return 0;
  const setB = new Set(b);
  const inter = a.filter((x) => setB.has(x)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : inter / union;
}

/** Fraction of overlap between two rent bands (intersection / union of ranges). */
function bandOverlap(a: [number, number] | null, b: [number, number] | null): number {
  if (!a || !b) return 0;
  const interLo = Math.max(a[0], b[0]);
  const interHi = Math.min(a[1], b[1]);
  const inter = Math.max(0, interHi - interLo);
  const unionLo = Math.min(a[0], b[0]);
  const unionHi = Math.max(a[1], b[1]);
  const union = unionHi - unionLo;
  if (union === 0) return 1; // both are the same single point
  return inter / union;
}

/** Relative weights of each dimension. Cities/neighborhoods dominate — you have to
 * want the same *place* first; budget and bed count refine within that. */
const WEIGHTS = { cities: 0.35, neighborhoods: 0.3, budget: 0.2, beds: 0.15 } as const;

/** The overlapping buckets that explain a match, for the candidate card UI. */
export interface SharedFacets {
  cities: string[];
  neighborhoods: string[];
}

/** Intersecting cities/neighborhoods between two signals (for "why matched"). */
export function sharedFacets(a: RoommateSignal, b: RoommateSignal): SharedFacets {
  const setBCities = new Set(b.cities);
  const setBHoods = new Set(b.neighborhoods);
  return {
    cities: a.cities.filter((c) => setBCities.has(c)),
    neighborhoods: a.neighborhoods.filter((n) => setBHoods.has(n)),
  };
}

/** Similarity of two roommate signals, 0–100 (rounded). */
export function roommateSimilarity(a: RoommateSignal, b: RoommateSignal): number {
  const score =
    WEIGHTS.cities * jaccard(a.cities, b.cities) +
    WEIGHTS.neighborhoods * jaccard(a.neighborhoods, b.neighborhoods) +
    WEIGHTS.budget * bandOverlap(a.budgetBand, b.budgetBand) +
    WEIGHTS.beds * jaccard(a.bedCounts, b.bedCounts);
  return Math.round(score * 100);
}
