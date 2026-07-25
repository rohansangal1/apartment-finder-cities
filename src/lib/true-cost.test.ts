import { describe, it, expect } from 'vitest';
import {
  estimateUtilities,
  estimateCommuteCost,
  trueMonthlyCost,
  allInMonthlyCost,
  DEFAULT_ASSUMPTIONS,
  type TrueCostAssumptions,
} from './true-cost';
import type { Listing, ScoredListing } from './types';

const assumptions = (over: Partial<TrueCostAssumptions> = {}): TrueCostAssumptions => ({
  ...DEFAULT_ASSUMPTIONS,
  ...over,
});

const scored = (over: Partial<ScoredListing> = {}): ScoredListing => ({
  listing: {
    id: 'l1',
    source: 'mock',
    listingUrl: '',
    address: '1 A St',
    neighborhood: 'N',
    city: 'San Francisco',
    lat: 0,
    lng: 0,
    rentMonthly: 3000,
    bedrooms: 1,
    tags: [],
    ratingValue: 4,
    ratingSource: 'google',
  } as Listing,
  matchScore: 80,
  commuteMinutes: 20,
  commuteMode: 'drive',
  whyItMatched: '',
  subScores: { commute: 80, price: 40, rating: 80, space: 100 },
  commuteApplies: true,
  ...over,
});

describe('estimateUtilities', () => {
  it('scales with bedroom count', () => {
    expect(estimateUtilities(0)).toBe(110);
    expect(estimateUtilities(1)).toBe(155);
    expect(estimateUtilities(3)).toBe(245);
  });

  it('always returns a whole number of dollars', () => {
    for (let beds = 0; beds <= 5; beds++) {
      expect(Number.isInteger(estimateUtilities(beds))).toBe(true);
    }
  });
});

describe('estimateCommuteCost', () => {
  it('costs nothing to walk or bike', () => {
    expect(estimateCommuteCost('walk', 30, assumptions())).toBe(0);
    expect(estimateCommuteCost('bike', 30, assumptions())).toBe(0);
  });

  it('charges the flat pass for transit, regardless of distance', () => {
    const a = assumptions({ transitPassMonthly: 90 });
    expect(estimateCommuteCost('transit', 5, a)).toBe(90);
    expect(estimateCommuteCost('transit', 55, a)).toBe(90);
  });

  it('scales driving with time, days in office, and per-minute cost', () => {
    const a = assumptions({ officeDaysPerWeek: 5, costPerDriveMinute: 0.5 });
    // 5 days × 4.3 weeks × 2 trips × 20 min × $0.50
    expect(estimateCommuteCost('drive', 20, a)).toBe(Math.round(5 * 4.3 * 2 * 20 * 0.5));
  });

  it('costs nothing in any mode when you never go in', () => {
    const a = assumptions({ officeDaysPerWeek: 0 });
    for (const mode of ['walk', 'bike', 'transit', 'drive'] as const) {
      expect(estimateCommuteCost(mode, 40, a)).toBe(0);
    }
  });

  it('is monotonic in office days for a driver', () => {
    let previous = -1;
    for (let days = 0; days <= 7; days++) {
      const cost = estimateCommuteCost('drive', 25, assumptions({ officeDaysPerWeek: days }));
      expect(cost).toBeGreaterThanOrEqual(previous);
      previous = cost;
    }
  });
});

describe('trueMonthlyCost', () => {
  it('totals rent, utilities and commute', () => {
    const b = trueMonthlyCost(3000, 1, 'transit', 20, assumptions());
    expect(b.total).toBe(b.rent + b.utilities + b.commute);
    expect(b.rent).toBe(3000);
  });

  it('drops the utilities estimate when the landlord includes them', () => {
    const included = trueMonthlyCost(3000, 2, 'walk', 0, assumptions({ utilitiesIncluded: true }));
    expect(included.utilities).toBe(0);
    expect(included.total).toBe(3000);
  });

  it('is never cheaper than the rent alone', () => {
    for (const beds of [0, 1, 3]) {
      const b = trueMonthlyCost(2500, beds, 'drive', 30, assumptions());
      expect(b.total).toBeGreaterThanOrEqual(b.rent);
    }
  });
});

describe('allInMonthlyCost', () => {
  it('counts the commute when the search actually has one', () => {
    const withCommute = allInMonthlyCost(scored({ commuteApplies: true, commuteMinutes: 30 }));
    const withoutCommute = allInMonthlyCost(scored({ commuteApplies: false, commuteMinutes: 30 }));
    expect(withCommute).toBeGreaterThan(withoutCommute);
  });

  it('ignores stated commute minutes for a remote search', () => {
    // A saved snapshot can carry minutes with commuteApplies false; charging for
    // a commute the user does not make would misrank it.
    const remoteShort = allInMonthlyCost(scored({ commuteApplies: false, commuteMinutes: 5 }));
    const remoteLong = allInMonthlyCost(scored({ commuteApplies: false, commuteMinutes: 90 }));
    expect(remoteShort).toBe(remoteLong);
  });

  it('treats a missing commuteApplies flag as no commute', () => {
    const missing = allInMonthlyCost(scored({ commuteApplies: undefined, commuteMinutes: 45 }));
    const explicitlyFalse = allInMonthlyCost(scored({ commuteApplies: false, commuteMinutes: 45 }));
    expect(missing).toBe(explicitlyFalse);
  });
});
