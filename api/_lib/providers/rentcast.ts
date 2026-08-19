/**
 * RentCast adapter — listing metadata (the production target for getListings).
 * Free tier, on-demand, legal. Maps RentCast's rental-listing shape into our
 * minimal `Listing`. We only keep metadata; the app links OUT for the full thing.
 *
 * Docs: https://developers.rentcast.io/  (GET /v1/listings/rental/long-term)
 */
import type { Listing, Source, SearchCriteria } from '../../../src/lib/types.js';
import { requireEnv } from '../env.js';
import { cached, TTL, hashKey } from '../cache.js';
import { assertWithinBudget, recordSpend } from '../budgetGuard.js';

const BASE = 'https://api.rentcast.io/v1';
const SOURCE: Source = 'rentcast';

/** Subset of RentCast's listing fields we consume. */
interface RentCastListing {
  id?: string;
  formattedAddress?: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  latitude?: number;
  longitude?: number;
  price?: number;
  bedrooms?: number;
  propertyType?: string;
  listingUrl?: string;
  // RentCast doesn't supply ratings; those come from the ratings provider.
}

/**
 * Split a user-entered location into RentCast's separate city + state params.
 * Accepts "Austin, TX", "Austin TX", or "Austin" (state left blank). Only a
 * trailing 2-letter US state code is treated as state; anything else stays city.
 */
function parseCityState(raw: string | undefined): { city: string; state: string } {
  const input = (raw || '').trim();
  if (!input) return { city: '', state: '' };

  // "City, ST" — comma-separated is the common, unambiguous form.
  const comma = input.match(/^(.*),\s*([A-Za-z]{2})$/);
  if (comma) return { city: comma[1].trim(), state: comma[2].toUpperCase() };

  // "City ST" — trailing 2-letter token with no comma.
  const space = input.match(/^(.*)\s+([A-Za-z]{2})$/);
  if (space) return { city: space[1].trim(), state: space[2].toUpperCase() };

  return { city: input, state: '' };
}

/** Fetch rental listings for the search criteria, cached by city+state+budget+beds. */
export async function fetchListings(criteria: Partial<SearchCriteria>): Promise<Listing[]> {
  const apiKey = requireEnv('RENTCAST_API_KEY');
  const { city, state } = parseCityState(criteria.city);
  if (!city) return [];

  const cacheKey = `listings:${SOURCE}:${hashKey(
    JSON.stringify({ city, state, maxRent: criteria.maxRent, beds: criteria.bedrooms })
  )}`;

  return cached(cacheKey, TTL.listings, async () => {
    await assertWithinBudget();

    // RentCast expects city and state as separate params; a combined
    // "Austin, TX" city string returns zero results.
    const params = new URLSearchParams({
      city,
      status: 'Active',
      limit: '25',
    });
    if (state) params.set('state', state);
    if (criteria.bedrooms != null) params.set('bedrooms', String(criteria.bedrooms));

    const res = await fetch(`${BASE}/listings/rental/long-term?${params}`, {
      headers: { 'X-Api-Key': apiKey, Accept: 'application/json' },
    });
    await recordSpend('rentcast');

    if (!res.ok) {
      throw new Error(`RentCast error ${res.status}: ${await safeText(res)}`);
    }
    const raw = (await res.json()) as RentCastListing[];
    return raw.map(mapListing).filter((l): l is Listing => l !== null);
  });
}

function mapListing(r: RentCastListing): Listing | null {
  if (r.latitude == null || r.longitude == null || r.price == null) return null;
  const address = r.addressLine1 || r.formattedAddress || 'Address unavailable';
  return {
    id: r.id || `${SOURCE}-${hashKey(`${address}:${r.price}`)}`,
    source: SOURCE,
    // RentCast may not return a canonical listing URL; the client's
    // resolveListingUrl() falls back to a source-site search if this is empty.
    listingUrl: r.listingUrl || '',
    address,
    // RentCast has no neighborhood field. Leave it blank rather than copying the
    // city in — a listing whose "neighborhood" is literally its city is
    // misleading. The UI falls back to city/address for the title.
    neighborhood: '',
    city: r.city || '',
    lat: r.latitude,
    lng: r.longitude,
    rentMonthly: r.price,
    bedrooms: r.bedrooms ?? 0,
    tags: r.propertyType ? [r.propertyType.toLowerCase()] : [],
    ratingValue: null, // filled in by the ratings provider downstream
    ratingSource: 'aggregated',
  };
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 300);
  } catch {
    return '<no body>';
  }
}
