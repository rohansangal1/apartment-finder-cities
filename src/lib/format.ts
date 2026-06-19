/** Formatting + outbound-link helpers shared across views. */
import type { Listing, CommuteMode, Source } from './types';

export function formatRent(n: number): string {
  return `$${n.toLocaleString('en-US')}/mo`;
}

export function formatBeds(beds: number): string {
  return beds === 0 ? 'Studio' : `${beds} bd`;
}

export function formatCommute(minutes: number, mode: CommuteMode): string {
  const label: Record<CommuteMode, string> = {
    walk: 'walk',
    transit: 'transit',
    bike: 'bike',
    drive: 'drive',
  };
  return `${minutes} min ${label[mode] ?? mode}`;
}

/** Title-case a source enum for display, e.g. 'apartments_com' -> 'Apartments.com'. */
export function sourceLabel(source: Source): string {
  const map: Record<Source, string> = {
    rentcast: 'RentCast',
    apartments_com: 'Apartments.com',
    zillow: 'Zillow',
    mock: 'Demo data',
  };
  return map[source] ?? source;
}

export function ratingSourceLabel(source: string): string {
  const map: Record<string, string> = {
    google: 'Google reviews',
    yelp: 'Yelp',
    'platform-users': 'Verified residents',
    aggregated: 'Aggregated sources',
  };
  return map[source] ?? source;
}

/**
 * Graceful link-rot handling. City listings turn over fast, so if a listingUrl
 * is known-stale (or missing) we degrade to a SEARCH url on the source site
 * rather than ever showing a broken link.
 *
 * In Phase 2 a cron job marks `last_seen_at`-stale links; here we accept an
 * explicit `isStale` flag and otherwise trust the deep link.
 */
export function resolveListingUrl(
  listing: Listing,
  isStale = false
): { url: string; isFallback: boolean } {
  if (listing.listingUrl && !isStale) {
    return { url: listing.listingUrl, isFallback: false };
  }
  return { url: buildSearchFallback(listing), isFallback: true };
}

function buildSearchFallback(listing: Listing): string {
  const query = encodeURIComponent(`${listing.address} ${listing.city}`);
  switch (listing.source) {
    case 'zillow':
      return `https://www.zillow.com/homes/${query}_rb/`;
    case 'apartments_com':
    case 'rentcast':
    case 'mock':
    default:
      return `https://www.apartments.com/${encodeURIComponent(
        listing.city.toLowerCase().replace(/\s+/g, '-')
      )}/?q=${query}`;
  }
}
