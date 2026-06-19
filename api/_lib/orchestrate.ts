/**
 * Server-side search orchestration — the paid mirror of src/lib/searchService.ts.
 * Doing this server-side hides keys and avoids many browser round-trips:
 *   listings (RentCast) → geocode origin (TravelTime) → commute per listing
 *   (TravelTime) → blended rating (Places + first-party) → score → rank.
 *
 * Reuses the SAME pure scoring engine the client uses (src/lib/scoring.ts), so
 * scores are identical regardless of where they're computed.
 */
import type { SearchCriteria, ScoredListing, GeoPoint } from '../../src/lib/types';
import { scoreListing, computeSubScores, explainMatch } from '../../src/lib/scoring';
import { fetchListings } from './providers/rentcast';
import { geocode, commute } from './providers/traveltime';
import { blendRating } from './ratings';

export async function orchestrateSearch(criteria: SearchCriteria): Promise<ScoredListing[]> {
  const listings = await fetchListings(criteria);

  let origin: GeoPoint | null = null;
  if (criteria.inPerson && criteria.workAddress) {
    origin = await geocode(criteria.workAddress);
  }

  const scored = await Promise.all(
    listings.map(async (listing): Promise<ScoredListing> => {
      let commuteMinutes = 0;
      if (criteria.inPerson && origin) {
        const c = await commute(origin, { lat: listing.lat, lng: listing.lng }, criteria.commuteMode);
        commuteMinutes = c.minutes;
      }

      const rating = await blendRating(listing);
      const enriched = { ...listing, ratingValue: rating.value, ratingSource: rating.source };

      const subScores = computeSubScores(enriched, criteria, commuteMinutes);
      const matchScore = scoreListing(enriched, criteria, commuteMinutes);

      return {
        listing: enriched,
        matchScore,
        commuteMinutes,
        commuteMode: criteria.commuteMode,
        whyItMatched: explainMatch(subScores, criteria),
        subScores,
      };
    })
  );

  return scored.sort((a, b) => b.matchScore - a.matchScore);
}
