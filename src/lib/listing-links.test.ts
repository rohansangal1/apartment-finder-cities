import { describe, it, expect } from 'vitest';
import {
  isListingStale,
  resolveListingUrl,
  isNycListing,
  buildListingLinks,
  STALE_AFTER_DAYS,
} from './listing-links';
import type { Listing } from './types';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-07-01T00:00:00Z');

const listing = (over: Partial<Listing> = {}): Listing => ({
  id: 'l1',
  source: 'mock',
  listingUrl: 'https://example.com/l1',
  address: '123 Main St',
  neighborhood: 'Chelsea',
  city: 'San Francisco',
  lat: 37.78,
  lng: -122.43,
  rentMonthly: 3000,
  bedrooms: 1,
  tags: [],
  ratingValue: 4,
  ratingSource: 'google',
  ...over,
});

const daysAgo = (n: number) => new Date(NOW - n * DAY).toISOString();

describe('isListingStale', () => {
  it('treats a recently-seen listing as fresh', () => {
    expect(isListingStale(listing({ lastSeenAt: daysAgo(1) }), NOW)).toBe(false);
  });

  it('treats a listing past the staleness window as stale', () => {
    expect(isListingStale(listing({ lastSeenAt: daysAgo(STALE_AFTER_DAYS + 1) }), NOW)).toBe(true);
  });

  it('is not stale exactly on the boundary', () => {
    expect(isListingStale(listing({ lastSeenAt: daysAgo(STALE_AFTER_DAYS) }), NOW)).toBe(false);
  });

  it('treats a listing with no lastSeenAt as fresh — we cannot tell', () => {
    expect(isListingStale(listing({ lastSeenAt: undefined }), NOW)).toBe(false);
  });

  it('treats an unparseable lastSeenAt as fresh rather than throwing', () => {
    expect(isListingStale(listing({ lastSeenAt: 'not a date' }), NOW)).toBe(false);
  });
});

describe('resolveListingUrl', () => {
  it('uses the real deep link when the listing is fresh', () => {
    const { url, isFallback } = resolveListingUrl(listing(), false);
    expect(url).toBe('https://example.com/l1');
    expect(isFallback).toBe(false);
  });

  it('degrades to an address search when the listing is stale', () => {
    const { url, isFallback } = resolveListingUrl(listing(), true);
    expect(isFallback).toBe(true);
    expect(url).toContain('zillow.com');
    expect(url).toContain('123-Main-St');
  });

  it('degrades when there is no listing URL at all', () => {
    const { url, isFallback } = resolveListingUrl(listing({ listingUrl: '' }), false);
    expect(isFallback).toBe(true);
    expect(url).toContain('zillow.com');
  });

  it('falls back to a map pin when the address has nothing sluggable', () => {
    const { url } = resolveListingUrl(listing({ listingUrl: '', address: '!!!', city: '???' }), false);
    expect(url).toContain('google.com/maps');
    expect(url).toContain('37.78,-122.43');
  });

  it('never returns an empty URL', () => {
    for (const l of [listing(), listing({ listingUrl: '' }), listing({ address: '' })]) {
      for (const stale of [true, false]) {
        expect(resolveListingUrl(l, stale).url.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('isNycListing', () => {
  it('matches the boroughs and common spellings, case-insensitively', () => {
    for (const city of ['New York', 'new york', 'NYC', 'Brooklyn', 'Queens', 'Staten Island']) {
      expect(isNycListing(listing({ city }))).toBe(true);
    }
  });

  it('does not match other cities', () => {
    for (const city of ['San Francisco', 'Austin', 'Boston', '']) {
      expect(isNycListing(listing({ city }))).toBe(false);
    }
  });
});

describe('buildListingLinks', () => {
  it('always offers Zillow', () => {
    const links = buildListingLinks(listing(), false);
    expect(links.map((l) => l.site)).toContain('zillow');
  });

  it('adds the NYC-only portals for New York listings', () => {
    const links = buildListingLinks(listing({ city: 'Brooklyn' }), false);
    expect(links.map((l) => l.site)).toEqual(['zillow', 'streeteasy', 'leasebreak']);
  });

  it('offers only Zillow elsewhere', () => {
    const links = buildListingLinks(listing({ city: 'Austin' }), false);
    expect(links.map((l) => l.site)).toEqual(['zillow']);
  });

  it('flags the NYC search links as fallbacks — they are not verified deep links', () => {
    const links = buildListingLinks(listing({ city: 'New York' }), false);
    for (const l of links.filter((x) => x.site !== 'zillow')) {
      expect(l.isFallback).toBe(true);
    }
  });

  it('URL-encodes addresses so query strings stay valid', () => {
    const links = buildListingLinks(
      listing({ city: 'New York', address: '5 W 21st St #3A', neighborhood: 'Flatiron' }),
      false
    );
    const streeteasy = links.find((l) => l.site === 'streeteasy')!;
    expect(streeteasy.url).not.toMatch(/[ #]/);
    expect(() => new URL(streeteasy.url)).not.toThrow();
  });

  it('produces parseable URLs for every link', () => {
    for (const city of ['New York', 'Austin']) {
      for (const stale of [true, false]) {
        for (const link of buildListingLinks(listing({ city }), stale)) {
          expect(() => new URL(link.url)).not.toThrow();
        }
      }
    }
  });
});
