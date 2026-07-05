/** Display formatting helpers shared across views.
 * (Outbound-link + link-rot logic lives in ./listing-links.) */
import type { CommuteMode, Source } from './types';

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
