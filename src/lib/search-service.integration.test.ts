import { describe, it, expect } from 'vitest';
import { runSearch } from './search-service';
import { MOCK_LISTINGS } from './mock-data/listings';
import type { SearchCriteria } from './types';

/**
 * End-to-end through the real mock data client — no module stubs. This is the
 * app's default data path (VITE_DATA_SOURCE=mock), so it catches wiring breaks
 * that unit tests with stubbed boundaries would sail straight past: a renamed
 * client method, a fixture that stops matching a city, a scorer that starts
 * throwing on real-shaped data.
 */
const criteria = (over: Partial<SearchCriteria> = {}): SearchCriteria => ({
  city: 'San Francisco',
  inPerson: true,
  workAddress: '1 Market St, San Francisco',
  maxRent: 3500,
  bedrooms: 1,
  commuteMode: 'transit',
  weights: { commute: 0.7, price: 0.7, rating: 0.5, space: 0.4 },
  ...over,
});

describe('runSearch against the real mock client', () => {
  it('returns scored listings for a city we have fixtures for', async () => {
    const results = await runSearch(criteria());
    expect(results.length).toBeGreaterThan(0);
  });

  it('only returns listings from the requested city', async () => {
    const results = await runSearch(criteria({ city: 'San Francisco' }));
    for (const r of results) expect(r.listing.city).toBe('San Francisco');
  });

  it('returns an empty list, not an error, for a city with no inventory', async () => {
    await expect(runSearch(criteria({ city: 'Nowhereville' }))).resolves.toEqual([]);
  });

  it('produces a valid, ranked, fully-populated result set', async () => {
    const results = await runSearch(criteria());

    for (const r of results) {
      expect(r.matchScore).toBeGreaterThanOrEqual(0);
      expect(r.matchScore).toBeLessThanOrEqual(100);
      expect(Number.isInteger(r.matchScore)).toBe(true);
      expect(r.whyItMatched.length).toBeGreaterThan(0);
      expect(r.commuteMinutes).toBeGreaterThanOrEqual(0);
      for (const value of Object.values(r.subScores)) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      }
    }

    const scores = results.map((r) => r.matchScore);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });

  it('does not mutate the shared fixtures between searches', async () => {
    const before = JSON.stringify(MOCK_LISTINGS);
    await runSearch(criteria());
    await runSearch(criteria({ city: 'Austin', maxRent: 2500 }));
    expect(JSON.stringify(MOCK_LISTINGS)).toBe(before);
  });

  it('is stable — the same search twice gives the same ranking', async () => {
    const first = await runSearch(criteria());
    const second = await runSearch(criteria());
    expect(second.map((r) => r.listing.id)).toEqual(first.map((r) => r.listing.id));
    expect(second.map((r) => r.matchScore)).toEqual(first.map((r) => r.matchScore));
  });

  it('scores every city in the fixture set without throwing', async () => {
    const cities = [...new Set(MOCK_LISTINGS.map((l) => l.city))];
    expect(cities.length).toBeGreaterThan(1);
    // Concurrently: the mock client's deliberate 350ms-per-call latency would
    // otherwise make this one test take as long as all the others combined.
    const perCity = await Promise.all(cities.map((city) => runSearch(criteria({ city }))));
    for (const results of perCity) expect(results.length).toBeGreaterThan(0);
  });
});
