/**
 * RentCast adapter — listing metadata (the production target for getListings).
 * Free tier, on-demand, legal. Maps RentCast's rental-listing shape into our
 * minimal `Listing`. We only keep metadata; the app links OUT for the full thing.
 *
 * Docs: https://developers.rentcast.io/  (GET /v1/listings/rental/long-term)
 */
import type { Listing, Source, SearchCriteria } from '../../../src/lib/types';
import { requireEnv } from '../env';
import { cached, TTL, hashKey } from '../cache';
import { assertWithinBudget, recordSpend } from '../budgetGuard';

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

/** Fetch rental listings for the search criteria, cached by city+budget+beds. */
export async function fetchListings(criteria: Partial<SearchCriteria>): Promise<Listing[]> {
  const apiKey = requireEnv('RENTCAST_API_KEY');
  const city = (criteria.city || '').trim();
  if (!city) return [];

  const cacheKey = `listings:${SOURCE}:${hashKey(
    JSON.stringify({ city, maxRent: criteria.maxRent, beds: criteria.bedrooms })
  )}`;

  return cached(cacheKey, TTL.listings, async () => {
    await assertWithinBudget();

    const params = new URLSearchParams({
      city,
      status: 'Active',
      limit: '25',
    });
    if (criteria.bedrooms != null) params.set('bedrooms', String(criteria.bedrooms));
    // RentCast expects a state; we let the city query carry it and post-filter loosely.

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
    neighborhood: r.city || '',
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
