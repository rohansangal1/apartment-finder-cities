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
import type { Listing, Rating } from '../../../src/lib/types.js';
import { requireEnv } from '../env.js';
import { cached, TTL, hashKey } from '../cache.js';
import { assertWithinBudget, recordSpend } from '../budgetGuard.js';

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

/** One nearby place, as handed to the AI-notes model. */
export interface NearbyPlace {
  name: string;
  rating: number | null;
  /** Straight-line metres from the listing — enough to say "a few blocks away". */
  meters: number;
}

/** What `fetchNearbyPlaces` will look for. Kept small and concrete so the model
 * can't ask for something the Places API answers badly. Plural because these
 * double as Places text queries AND as the progress label the user reads
 * ("Searching for pharmacies near Bushwick") — one string, no pluralizing. */
export const NEARBY_CATEGORIES = [
  'grocery stores',
  'transit stations',
  'parks',
  'gyms',
  'restaurants',
  'pharmacies',
] as const;

export type NearbyCategory = (typeof NEARBY_CATEGORIES)[number];

/** Metres between two lat/lng points (equirectangular approximation — plenty
 * accurate at neighborhood scale and far cheaper than haversine). */
function metersBetween(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6_371_000;
  const x = ((bLng - aLng) * Math.PI) / 180 * Math.cos(((aLat + bLat) * Math.PI) / 360);
  const y = ((bLat - aLat) * Math.PI) / 180;
  return Math.round(Math.sqrt(x * x + y * y) * R);
}

/**
 * Nearby places of one category around a listing, nearest first (max 5).
 *
 * Backs the `lookup_nearby_places` tool in the AI-notes endpoint. Cached for a
 * day on a coarse (3-decimal, ~110 m) lat/lng so neighbouring listings on the
 * same block share one paid lookup.
 */
export async function fetchNearbyPlaces(
  lat: number,
  lng: number,
  category: NearbyCategory
): Promise<NearbyPlace[]> {
  const apiKey = requireEnv('GOOGLE_MAPS_API_KEY');
  const key = hashKey(`${lat.toFixed(3)},${lng.toFixed(3)},${category}`);

  return cached(`nearby:places:${key}`, TTL.autocomplete, async () => {
    await assertWithinBudget();
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.displayName,places.rating,places.location',
      },
      body: JSON.stringify({
        textQuery: category,
        maxResultCount: 5,
        // Bias hard to walking distance — a grocery store 5 km away tells a
        // renter nothing about this address.
        locationBias: { circle: { center: { latitude: lat, longitude: lng }, radius: 1200 } },
      }),
    });
    await recordSpend('places');
    if (!res.ok) throw new Error(`Places ${res.status}`);

    const data = (await res.json()) as {
      places?: Array<{
        displayName?: { text?: string };
        rating?: number;
        location?: { latitude: number; longitude: number };
      }>;
    };

    return (data.places ?? [])
      .map((p) => ({
        name: p.displayName?.text ?? '',
        rating: p.rating ?? null,
        meters: p.location
          ? metersBetween(lat, lng, p.location.latitude, p.location.longitude)
          : Number.MAX_SAFE_INTEGER,
      }))
      .filter((p) => p.name)
      .sort((a, b) => a.meters - b.meters);
  });
}
