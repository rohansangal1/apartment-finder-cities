/**
 * Rating blend (server side). Returns ONE value the UI consumes, computed from a
 * layered, weighted mix of external ratings (Google Places now) and first-party
 * platform reviews. As first-party count grows, its weight grows — the cold-start
 * handoff. In Phase 1 there's no reviews DB yet, so `firstParty` is empty and we
 * pass through the external rating; Phase 2 wires real reviews in here.
 *
 * Mirrors the mock client's blendRating so behavior is consistent across sources.
 */
import type { Listing, Rating, Review } from '../../src/lib/types';
import { fetchPlacesRating } from './providers/places';

export async function blendRating(
  listing: Listing,
  firstParty: Review[] = []
): Promise<Rating> {
  const external = await fetchPlacesRating(listing);

  if (firstParty.length === 0) {
    return external; // value may be null → UI shows "Not enough info"
  }

  // First-party average, weighting verified (lived-here) reviews 2x.
  let wSum = 0;
  let sSum = 0;
  for (const r of firstParty) {
    const w = r.livedHereVerified ? 2 : 1;
    wSum += w;
    sSum += r.stars * w;
  }
  const fpAvg = sSum / wSum;

  if (external.value == null) {
    return { value: round1(fpAvg), source: 'platform-users' };
  }

  // First-party weight grows with review count, capped at 0.8.
  const fpWeight = Math.min(0.8, firstParty.length / (firstParty.length + 4) + 0.1);
  const blended = fpAvg * fpWeight + external.value * (1 - fpWeight);
  return { value: round1(blended), source: 'aggregated' };
}

const round1 = (n: number): number => Math.round(n * 10) / 10;
