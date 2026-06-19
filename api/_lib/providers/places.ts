/**
 * Google Places adapter — building ratings (early external layer of getRating).
 * Looks up the building by address and returns its Places rating. Cached ~1 week.
 *
 * This is ONE layer of the blended rating. The full blend (external + first-party
 * platform reviews, weighting verified residents higher as their count grows)
 * happens in `_lib/ratings.ts`, which calls this.
 *
 * Docs: https://developers.google.com/maps/documentation/places/web-service
 *   - Text Search (New): POST https://places.googleapis.com/v1/places:searchText
 */
import type { Listing, Rating } from '../../../src/lib/types';
import { requireEnv } from '../env';
import { cached, TTL, hashKey } from '../cache';
import { assertWithinBudget, recordSpend } from '../budgetGuard';

const ENDPOINT = 'https://places.googleapis.com/v1/places:searchText';

/** Fetch the external (Google Places) rating for a building, or null if sparse. */
export async function fetchPlacesRating(listing: Listing): Promise<Rating> {
  const apiKey = requireEnv('GOOGLE_MAPS_API_KEY');
  const query = `${listing.address}, ${listing.city}`;

  return cached(`rating:places:${hashKey(query.toLowerCase())}`, TTL.rating, async () => {
    await assertWithinBudget();
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        // Field mask keeps the call cheap — only ask for rating fields.
        'X-Goog-FieldMask': 'places.rating,places.userRatingCount',
      },
      body: JSON.stringify({ textQuery: query, maxResultCount: 1 }),
    });
    await recordSpend('places');
    if (!res.ok) throw new Error(`Places ${res.status}`);

    const data = (await res.json()) as {
      places?: Array<{ rating?: number; userRatingCount?: number }>;
    };
    const place = data.places?.[0];
    // Too sparse to trust → null, so the UI shows "Not enough info" (never faked).
    if (!place?.rating || (place.userRatingCount ?? 0) < 3) {
      return { value: null, source: 'google' };
    }
    return { value: place.rating, source: 'google' };
  });
}
