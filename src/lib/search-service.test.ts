import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Listing, ScoredListing, SearchCriteria } from './types';

// The data client is the app's single boundary to the outside world, so stubbing
// it here exercises the real orchestration and the real scoring engine against
// controlled inputs. `serverSearch` is null (the mock source) so runSearch takes
// the local-composition path.
const listings: Listing[] = [
  {
    id: 'cheap-far',
    source: 'mock',
    listingUrl: '',
    address: '1 Far St',
    neighborhood: 'Outer',
    city: 'San Francisco',
    lat: 1,
    lng: 1,
    rentMonthly: 1800,
    bedrooms: 1,
    tags: [],
    ratingValue: 3,
    ratingSource: 'google',
  },
  {
    id: 'pricey-near',
    source: 'mock',
    listingUrl: '',
    address: '2 Near St',
    neighborhood: 'Inner',
    city: 'San Francisco',
    lat: 2,
    lng: 2,
    rentMonthly: 3400,
    bedrooms: 1,
    tags: [],
    ratingValue: 5,
    ratingSource: 'google',
  },
];

const commuteByListing: Record<string, number> = { 'cheap-far': 50, 'pricey-near': 5 };

vi.mock('./data-client', () => ({
  serverSearch: null,
  getListings: vi.fn(async () => listings),
  geocode: vi.fn(async () => ({ lat: 0, lng: 0 })),
  getCommute: vi.fn(async (_origin: unknown, dest: { lat: number }) => ({
    minutes: dest.lat === 1 ? commuteByListing['cheap-far'] : commuteByListing['pricey-near'],
  })),
  getRating: vi.fn(async (l: Listing) => ({ value: l.ratingValue, source: 'google' })),
}));

const { runSearch, SORTERS } = await import('./search-service');

const criteria = (over: Partial<SearchCriteria> = {}): SearchCriteria => ({
  city: 'San Francisco',
  inPerson: true,
  workAddress: '1 Market St',
  maxRent: 3500,
  bedrooms: 1,
  commuteMode: 'transit',
  weights: { commute: 1, price: 1, rating: 1, space: 1 },
  ...over,
});

beforeEach(() => vi.clearAllMocks());

describe('runSearch', () => {
  it('returns one scored entry per listing', async () => {
    const results = await runSearch(criteria());
    expect(results).toHaveLength(listings.length);
  });

  it('returns them ranked best-first', async () => {
    const results = await runSearch(criteria());
    const scores = results.map((r) => r.matchScore);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });

  it('lets the weights decide the winner', async () => {
    const byPrice = await runSearch(
      criteria({ weights: { commute: 0, price: 1, rating: 0, space: 0 } })
    );
    expect(byPrice[0].listing.id).toBe('cheap-far');

    const byCommute = await runSearch(
      criteria({ weights: { commute: 1, price: 0, rating: 0, space: 0 } })
    );
    expect(byCommute[0].listing.id).toBe('pricey-near');
  });

  it('attaches the commute it actually measured', async () => {
    const results = await runSearch(criteria());
    const far = results.find((r) => r.listing.id === 'cheap-far')!;
    expect(far.commuteMinutes).toBe(50);
    expect(far.commuteApplies).toBe(true);
  });

  it('skips geocoding and reports no commute for a remote search', async () => {
    const { geocode } = await import('./data-client');
    const results = await runSearch(criteria({ inPerson: false }));
    expect(geocode).not.toHaveBeenCalled();
    for (const r of results) {
      expect(r.commuteMinutes).toBe(0);
      expect(r.commuteApplies).toBe(false);
    }
  });

  it('gives every entry a non-empty explanation', async () => {
    const results = await runSearch(criteria());
    for (const r of results) expect(r.whyItMatched.length).toBeGreaterThan(0);
  });
});

describe('SORTERS', () => {
  const entry = (over: Partial<ScoredListing> & { rent?: number }): ScoredListing => ({
    listing: { ...listings[0], rentMonthly: over.rent ?? 3000 },
    matchScore: 50,
    commuteMinutes: 20,
    commuteMode: 'transit',
    whyItMatched: '',
    subScores: { commute: 50, price: 50, rating: 50, space: 50 },
    commuteApplies: true,
    ...over,
  });

  it('orders by match score, best first', () => {
    const sorted = [entry({ matchScore: 40 }), entry({ matchScore: 90 })].sort(SORTERS.match);
    expect(sorted.map((s) => s.matchScore)).toEqual([90, 40]);
  });

  it('orders by rent, cheapest first', () => {
    const sorted = [entry({ rent: 4000 }), entry({ rent: 2000 })].sort(SORTERS.price);
    expect(sorted.map((s) => s.listing.rentMonthly)).toEqual([2000, 4000]);
  });

  it('orders by commute, shortest first', () => {
    const sorted = [entry({ commuteMinutes: 40 }), entry({ commuteMinutes: 8 })].sort(
      SORTERS.commute
    );
    expect(sorted.map((s) => s.commuteMinutes)).toEqual([8, 40]);
  });

  it('orders by all-in cost, which can disagree with rent alone', () => {
    // A cheaper rent with a long drive can cost more all-in than a dearer walk.
    const drivesFar = entry({ rent: 2600, commuteMode: 'drive', commuteMinutes: 45 });
    const walksClose = entry({ rent: 2800, commuteMode: 'walk', commuteMinutes: 5 });
    const byRent = [drivesFar, walksClose].sort(SORTERS.price);
    const byAllIn = [drivesFar, walksClose].sort(SORTERS.truecost);
    expect(byRent[0].listing.rentMonthly).toBe(2600);
    expect(byAllIn[0].listing.rentMonthly).toBe(2800);
  });
});
