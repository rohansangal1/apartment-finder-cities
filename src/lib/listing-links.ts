/**
 * Outbound listing links — a single-purpose module for "where do I send the user
 * to see this apartment on a real rental site?".
 *
 * Why its own file (moved out of format.ts): link resolution grew from one Zillow
 * fallback into a small policy — staleness detection, per-site URL builders, and
 * NYC-only sites. Keeping it together makes the whole "link rot" story readable
 * in one place, and format.ts goes back to being just display formatting.
 *
 * Design principle throughout: *graceful degradation*. External listings turn
 * over fast and aggregators (RentCast) often don't give a canonical URL, so we
 * never risk a dead detail page — every link falls back to a SEARCH on the site
 * for the specific address/neighborhood. A search page that finds the place (or
 * the closest live one) always beats a 404.
 */
import type { Listing } from './types';

/** Days after `lastSeenAt` beyond which a listing is treated as possibly gone. */
export const STALE_AFTER_DAYS = 21;

/**
 * True when a listing was last seen live long enough ago that its link may have
 * rotted. Listings with no `lastSeenAt` are treated as fresh (we can't tell).
 */
export function isListingStale(listing: Listing, now: number = Date.now()): boolean {
  if (!listing.lastSeenAt) return false;
  const seen = Date.parse(listing.lastSeenAt);
  if (Number.isNaN(seen)) return false;
  return now - seen > STALE_AFTER_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * Graceful link-rot handling for Zillow specifically. If a listingUrl is
 * known-stale (or missing) we degrade to a Zillow SEARCH url built from the
 * address rather than ever showing a broken deep link.
 */
export function resolveListingUrl(
  listing: Listing,
  isStale = false
): { url: string; isFallback: boolean } {
  if (listing.listingUrl && !isStale) {
    return { url: listing.listingUrl, isFallback: false };
  }
  return { url: buildZillowSearch(listing), isFallback: true };
}

function buildZillowSearch(listing: Listing): string {
  // We often don't know which site actually hosts the listing (aggregators like
  // RentCast don't always give a canonical URL). Rather than a generic web
  // search, deep-link into Zillow's rental search for the *specific address* —
  // the dominant rental portal, so this surfaces the real listing (or the closest
  // live one) far more often than a Google query, and never a dead detail page.
  const slug = addressSlug(`${listing.address} ${listing.city}`);
  if (slug) return `https://www.zillow.com/homes/for_rent/${slug}_rb/`;

  // No usable address text — fall back to a precise map pin for the coordinates.
  return `https://www.google.com/maps/search/?api=1&query=${listing.lat},${listing.lng}`;
}

/**
 * Turn a free-form address into Zillow's URL slug form: alphanumerics kept,
 * runs of anything else collapsed to single hyphens (e.g. "123 Main St, Austin
 * TX" -> "123-Main-St-Austin-TX"). Returns '' when nothing usable remains.
 */
function addressSlug(raw: string): string {
  return raw
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * NYC has a rich ecosystem of rental sites beyond Zillow (StreetEasy is the
 * dominant local portal; Leasebreak specializes in lease-break / sublet deals).
 * We only surface these for New York listings — feature-gating by data keeps
 * cards clean and avoids linking to sites that have no coverage elsewhere.
 */
export function isNycListing(listing: Listing): boolean {
  return /new york|nyc|manhattan|brooklyn|queens|bronx|staten island/i.test(
    listing.city ?? ''
  );
}

/** One outbound link: which site, its display label, the URL, and whether the
 * URL is a search fallback (vs. a real deep link) so the UI can hint at it. */
export interface ListingLink {
  site: 'zillow' | 'streeteasy' | 'leasebreak';
  label: string;
  url: string;
  isFallback: boolean;
}

/**
 * Build the row of "view this apartment on…" links for a listing.
 *
 * Zillow is always present (deep link when fresh, address search otherwise).
 * StreetEasy + Leasebreak are added for NYC listings only.
 *
 * NOTE: StreetEasy and Leasebreak have no public API, and scraping them violates
 * their ToS — so these are best-effort SEARCH urls, not verified deep links. The
 * exact query-param names are the one fragile part; both sites bot-gate automated
 * checks, so they're isolated in this single function. If a landing page looks
 * wrong, the fix is a one-line change to the URL below.
 */
export function buildListingLinks(listing: Listing, isStale: boolean): ListingLink[] {
  const zillow = resolveListingUrl(listing, isStale);
  const links: ListingLink[] = [
    { site: 'zillow', label: 'Zillow', url: zillow.url, isFallback: zillow.isFallback },
  ];

  if (isNycListing(listing)) {
    const addressQuery = encodeURIComponent(`${listing.address} ${listing.city}`);
    // A neighborhood query fits Leasebreak's smaller, curated inventory better
    // than a precise street address (which it may not carry).
    const neighborhoodQuery = encodeURIComponent(listing.neighborhood || listing.city);

    links.push({
      site: 'streeteasy',
      label: 'StreetEasy',
      url: `https://streeteasy.com/search?search=${addressQuery}`,
      isFallback: true,
    });
    links.push({
      site: 'leasebreak',
      label: 'Leasebreak',
      url: `https://www.leasebreak.com/search?search_text=${neighborhoodQuery}`,
      isFallback: true,
    });
  }

  return links;
}
