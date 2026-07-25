import { describe, it, expect } from 'vitest';
import {
  computeSubScores,
  normalizeWeights,
  scoreListing,
  explainMatch,
  MAX_COMMUTE,
} from './scoring';
import type { Listing, SearchCriteria, Weights } from './types';

const listing = (over: Partial<Listing> = {}): Listing => ({
  id: 'l1',
  source: 'mock',
  listingUrl: 'https://example.com/l1',
  address: '1200 Fillmore St',
  neighborhood: 'Lower Haight',
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

describe('normalizeWeights', () => {
  it('scales any weights so they sum to 1', () => {
    const w = normalizeWeights({ commute: 0.7, price: 0.7, rating: 0.5, space: 0.4 });
    const sum = w.commute + w.price + w.rating + w.space;
    expect(sum).toBeCloseTo(1, 10);
  });

  it('preserves the ratio between weights', () => {
    // commute is twice price going in, so it must stay twice price coming out.
    const w = normalizeWeights({ commute: 0.8, price: 0.4, rating: 0.4, space: 0.4 });
    expect(w.commute / w.price).toBeCloseTo(2, 10);
  });

  it('does not divide by zero when every weight is zero', () => {
    const w = normalizeWeights({ commute: 0, price: 0, rating: 0, space: 0 });
    for (const v of Object.values(w)) expect(Number.isFinite(v)).toBe(true);
  });
});

describe('computeSubScores — commute', () => {
  it('is 100 at the door and 0 at the maximum acceptable commute', () => {
    expect(computeSubScores(listing(), criteria(), 0).commute).toBe(100);
    expect(computeSubScores(listing(), criteria(), MAX_COMMUTE).commute).toBe(0);
  });

  it('falls off linearly in between', () => {
    const half = computeSubScores(listing(), criteria(), MAX_COMMUTE / 2).commute;
    expect(half).toBeCloseTo(50, 6);
  });

  it('clamps rather than going negative past the maximum', () => {
    expect(computeSubScores(listing(), criteria(), MAX_COMMUTE * 5).commute).toBe(0);
  });

  it('sits out entirely for a remote search, however long the journey', () => {
    const remote = criteria({ inPerson: false });
    expect(computeSubScores(listing(), remote, 999).commute).toBe(100);
  });
});

describe('computeSubScores — price', () => {
  const cap = 3500;
  const priceAt = (rent: number) =>
    computeSubScores(listing({ rentMonthly: rent }), criteria({ maxRent: cap }), 0).price;

  it('gives full marks at zero rent and near-zero at the cap', () => {
    expect(priceAt(0)).toBe(100);
    expect(priceAt(cap)).toBeCloseTo(4.76, 1);
  });

  it('measures headroom linearly below the cap', () => {
    expect(priceAt(cap * 0.5)).toBeCloseTo(52.4, 1);
    expect(priceAt(cap * 0.9)).toBeCloseTo(14.3, 1);
  });

  // ---- Regression: the two branches used to sit on different scales, so a
  // listing $1 over budget scored ~100 while one exactly at budget scored ~5.
  // Over-budget listings therefore outranked affordable ones on price fit.
  it('does not jump when rent crosses the cap', () => {
    const at = priceAt(cap);
    const justOver = priceAt(cap + 1);
    expect(Math.abs(at - justOver)).toBeLessThan(1);
  });

  it('never scores an over-budget listing above an at-budget one', () => {
    const at = priceAt(cap);
    for (const overBy of [1, 10, 100, 350, 1000, 5000]) {
      expect(priceAt(cap + overBy)).toBeLessThanOrEqual(at);
    }
  });

  it('is monotonically non-increasing across the whole rent range', () => {
    let previous = Infinity;
    for (let rent = 0; rent <= cap * 2; rent += 25) {
      const score = priceAt(rent);
      expect(score).toBeLessThanOrEqual(previous + 1e-9);
      previous = score;
    }
  });

  it('stays inside 0–100 for absurd rents', () => {
    for (const rent of [0, 1, cap, cap * 10, 1_000_000]) {
      expect(priceAt(rent)).toBeGreaterThanOrEqual(0);
      expect(priceAt(rent)).toBeLessThanOrEqual(100);
    }
  });
});

describe('computeSubScores — rating', () => {
  it('rescales a 1–5 star rating onto 0–100', () => {
    expect(computeSubScores(listing({ ratingValue: 5 }), criteria(), 0).rating).toBe(100);
    expect(computeSubScores(listing({ ratingValue: 4.2 }), criteria(), 0).rating).toBeCloseTo(84, 6);
  });

  it('treats an unknown rating as neutral, not as bad', () => {
    const unknown = computeSubScores(listing({ ratingValue: null }), criteria(), 0).rating;
    expect(unknown).toBe(60);
    // The point of the neutral default: an unreviewed building must not be
    // buried beneath a genuinely badly-reviewed one.
    const oneStar = computeSubScores(listing({ ratingValue: 1 }), criteria(), 0).rating;
    expect(unknown).toBeGreaterThan(oneStar);
  });
});

describe('computeSubScores — space', () => {
  it('gives full marks for meeting the bedroom count', () => {
    expect(computeSubScores(listing({ bedrooms: 2 }), criteria({ bedrooms: 2 }), 0).space).toBe(100);
  });

  it('gives no bonus for bedrooms the user did not ask for', () => {
    const exact = computeSubScores(listing({ bedrooms: 2 }), criteria({ bedrooms: 2 }), 0).space;
    const extra = computeSubScores(listing({ bedrooms: 4 }), criteria({ bedrooms: 2 }), 0).space;
    expect(extra).toBe(exact);
  });

  it('deducts 40 per missing bedroom, clamped at zero', () => {
    expect(computeSubScores(listing({ bedrooms: 1 }), criteria({ bedrooms: 2 }), 0).space).toBe(60);
    expect(computeSubScores(listing({ bedrooms: 0 }), criteria({ bedrooms: 2 }), 0).space).toBe(20);
    expect(computeSubScores(listing({ bedrooms: 0 }), criteria({ bedrooms: 5 }), 0).space).toBe(0);
  });
});

describe('scoreListing', () => {
  it('returns a whole number within 0–100', () => {
    const score = scoreListing(listing(), criteria(), 20);
    expect(Number.isInteger(score)).toBe(true);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('is the weighted average of the four sub-scores', () => {
    const c = criteria({ weights: { commute: 0.7, price: 0.7, rating: 0.5, space: 0.4 } });
    const l = listing({ rentMonthly: 3100, bedrooms: 1, ratingValue: 4.2 });
    const sub = computeSubScores(l, c, 18);
    const w = normalizeWeights(c.weights);
    const expected =
      sub.commute * w.commute + sub.price * w.price + sub.rating * w.rating + sub.space * w.space;
    expect(scoreListing(l, c, 18)).toBe(Math.round(expected));
  });

  it('lets the weights actually move the ranking', () => {
    // A far-away bargain vs. a nearby expensive place: whichever dimension the
    // user leans on should win.
    const bargainFarAway = listing({ id: 'far', rentMonthly: 1500 });
    const pricyNearby = listing({ id: 'near', rentMonthly: 3400 });
    const priceFirst = criteria({ weights: { commute: 0, price: 1, rating: 0, space: 0 } });
    const commuteFirst = criteria({ weights: { commute: 1, price: 0, rating: 0, space: 0 } });

    expect(scoreListing(bargainFarAway, priceFirst, 50)).toBeGreaterThan(
      scoreListing(pricyNearby, priceFirst, 5)
    );
    expect(scoreListing(pricyNearby, commuteFirst, 5)).toBeGreaterThan(
      scoreListing(bargainFarAway, commuteFirst, 50)
    );
  });

  it('ranks an affordable listing above an identical over-budget one', () => {
    // The user-visible consequence of the price-continuity fix.
    const c = criteria({ maxRent: 3000, weights: { commute: 0, price: 1, rating: 0, space: 0 } });
    const affordable = scoreListing(listing({ rentMonthly: 2900 }), c, 10);
    const overBudget = scoreListing(listing({ rentMonthly: 3300 }), c, 10);
    expect(affordable).toBeGreaterThan(overBudget);
  });

  it('ignores a dimension weighted to zero', () => {
    const noRating: Weights = { commute: 1, price: 1, rating: 0, space: 1 };
    const c = criteria({ weights: noRating });
    const great = scoreListing(listing({ ratingValue: 5 }), c, 10);
    const awful = scoreListing(listing({ ratingValue: 1 }), c, 10);
    expect(great).toBe(awful);
  });
});

describe('explainMatch', () => {
  it('names the dimensions the listing actually did well on', () => {
    const c = criteria({ weights: { commute: 1, price: 0, rating: 0, space: 0 } });
    const l = listing();
    const why = explainMatch(computeSubScores(l, c, 2), c, l);
    expect(why).toMatch(/commute/i);
  });

  it('never claims a commute for a remote search', () => {
    const c = criteria({ inPerson: false });
    const l = listing();
    const why = explainMatch(computeSubScores(l, c, 0), c, l);
    expect(why).not.toMatch(/commute/i);
  });

  it('never claims reviews for a listing that has no rating', () => {
    const c = criteria();
    const l = listing({ ratingValue: null });
    const why = explainMatch(computeSubScores(l, c, 10), c, l);
    expect(why).not.toMatch(/rated|review/i);
  });

  it('falls back to a neutral sentence when nothing is worth bragging about', () => {
    const c = criteria({ maxRent: 1000, bedrooms: 4 });
    const l = listing({ rentMonthly: 4000, bedrooms: 0, ratingValue: null });
    const why = explainMatch(computeSubScores(l, c, MAX_COMMUTE), c, l);
    expect(why).toBe('A reasonable overall match for your search.');
  });

  it('always returns a capitalised, full sentence', () => {
    const c = criteria();
    const l = listing();
    const why = explainMatch(computeSubScores(l, c, 5), c, l);
    expect(why[0]).toBe(why[0].toUpperCase());
    expect(why.endsWith('.')).toBe(true);
  });
});
