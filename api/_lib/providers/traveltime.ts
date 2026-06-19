/**
 * TravelTime adapter — geocoding + commute times (production target for both
 * geocode() and getCommute()). Purpose-built for commute-based search, flat-rate
 * pricing, transit-aware.
 *
 * Docs: https://docs.traveltime.com/
 *   - Geocoding:        GET  /v4/geocoding/search
 *   - Route times:      POST /v4/routes   (we use a single origin → destination)
 *
 * Both results are cached: geocodes ~forever (coordinates never change), commute
 * times for weeks keyed by (originHash, destination, mode).
 */
import type { GeoPoint, Commute, CommuteMode } from '../../../src/lib/types';
import { requireEnv } from '../env';
import { cached, TTL, hashKey } from '../cache';
import { assertWithinBudget, recordSpend } from '../budgetGuard';

const BASE = 'https://api.traveltimeapp.com/v4';

/** Map our commute modes to TravelTime transportation types. */
const TT_TRANSPORT: Record<CommuteMode, string> = {
  walk: 'walking',
  bike: 'cycling',
  transit: 'public_transport',
  drive: 'driving',
};

function authHeaders() {
  return {
    'X-Application-Id': requireEnv('TRAVELTIME_APP_ID'),
    'X-Api-Key': requireEnv('TRAVELTIME_API_KEY'),
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

export async function geocode(address: string): Promise<GeoPoint> {
  const q = address.trim();
  if (!q) throw new Error('geocode: empty address');

  return cached(`geocode:${hashKey(q.toLowerCase())}`, TTL.geocode, async () => {
    await assertWithinBudget();
    const res = await fetch(`${BASE}/geocoding/search?query=${encodeURIComponent(q)}`, {
      headers: authHeaders(),
    });
    await recordSpend('geocode');
    if (!res.ok) throw new Error(`TravelTime geocode ${res.status}`);

    const data = (await res.json()) as {
      features?: Array<{ geometry?: { coordinates?: [number, number] } }>;
    };
    const coords = data.features?.[0]?.geometry?.coordinates;
    if (!coords) throw new Error(`No geocode result for "${q}"`);
    // GeoJSON order is [lng, lat].
    return { lat: coords[1], lng: coords[0] };
  });
}

export async function commute(
  origin: GeoPoint,
  destination: GeoPoint,
  mode: CommuteMode
): Promise<Commute> {
  const originHash = hashKey(`${origin.lat.toFixed(5)},${origin.lng.toFixed(5)}`);
  const destHash = hashKey(`${destination.lat.toFixed(5)},${destination.lng.toFixed(5)}`);
  const key = `commute:${originHash}:${destHash}:${mode}`;

  return cached(key, TTL.commute, async () => {
    await assertWithinBudget();
    const body = {
      locations: [
        { id: 'origin', coords: { lat: origin.lat, lng: origin.lng } },
        { id: 'dest', coords: { lat: destination.lat, lng: destination.lng } },
      ],
      departure_searches: [
        {
          id: 'commute',
          departure_location_id: 'origin',
          arrival_location_ids: ['dest'],
          transportation: { type: TT_TRANSPORT[mode] },
          departure_time: new Date().toISOString(),
          properties: ['travel_time'],
        },
      ],
    };
    const res = await fetch(`${BASE}/routes`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
    await recordSpend('traveltime');
    if (!res.ok) throw new Error(`TravelTime routes ${res.status}`);

    const data = (await res.json()) as {
      results?: Array<{
        locations?: Array<{ properties?: Array<{ travel_time?: number }> }>;
      }>;
    };
    const seconds = data.results?.[0]?.locations?.[0]?.properties?.[0]?.travel_time;
    if (seconds == null) throw new Error('No commute result');
    return { minutes: Math.round(seconds / 60), mode };
  });
}
