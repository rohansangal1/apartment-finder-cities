/**
 * True monthly cost of living somewhere — rent is only part of it. This module is
 * pure and deliberately uses transparent, rough estimates (documented per line)
 * so the UI can show an honest ballpark, not a false-precision figure. Real
 * utility/commute data can slot in behind the same shapes later.
 */
import type { CommuteMode, ScoredListing } from './types';

export interface TrueCostAssumptions {
  /** Days per week commuting to the office (0–7). Drives commute cost. */
  officeDaysPerWeek: number;
  /** If the landlord includes utilities, we don't add an estimate. */
  utilitiesIncluded: boolean;
  /** Monthly transit pass price, used when the commute mode is transit. */
  transitPassMonthly: number;
  /** Rough per-minute cost of driving (gas + wear), one direction. */
  costPerDriveMinute: number;
}

export const DEFAULT_ASSUMPTIONS: TrueCostAssumptions = {
  officeDaysPerWeek: 3,
  utilitiesIncluded: false,
  transitPassMonthly: 90, // typical US metro monthly pass
  costPerDriveMinute: 0.5, // ~$0.50/min ≈ gas + maintenance for a short urban drive
};

export interface TrueCostBreakdown {
  rent: number;
  utilities: number;
  commute: number;
  total: number;
}

/** Rough monthly utilities (electric/gas/water/internet) scaled by size. */
export function estimateUtilities(bedrooms: number): number {
  return Math.round(110 + 45 * bedrooms);
}

/**
 * Rough monthly commute cost. Walking/biking are free; transit is the flat pass
 * (only worth it if you actually go in); driving is round trips × one-way minutes
 * × per-minute cost, averaged over ~4.3 weeks/month.
 */
export function estimateCommuteCost(
  mode: CommuteMode,
  oneWayMinutes: number,
  a: TrueCostAssumptions
): number {
  if (a.officeDaysPerWeek <= 0) return 0;
  const monthlyOfficeDays = a.officeDaysPerWeek * 4.3;
  switch (mode) {
    case 'walk':
    case 'bike':
      return 0;
    case 'transit':
      return Math.round(a.transitPassMonthly);
    case 'drive':
      return Math.round(monthlyOfficeDays * 2 * oneWayMinutes * a.costPerDriveMinute);
  }
}

/** Combine rent + estimated utilities + estimated commute into a monthly total. */
export function trueMonthlyCost(
  rent: number,
  bedrooms: number,
  mode: CommuteMode,
  oneWayMinutes: number,
  a: TrueCostAssumptions
): TrueCostBreakdown {
  const utilities = a.utilitiesIncluded ? 0 : estimateUtilities(bedrooms);
  const commute = estimateCommuteCost(mode, oneWayMinutes, a);
  return { rent, utilities, commute, total: rent + utilities + commute };
}

/**
 * All-in monthly cost for a scored listing, using DEFAULT_ASSUMPTIONS — the
 * figure used to rank ("cheapest all-in") and to label cards/compare. The
 * detail-page calculator stays interactive with its own assumptions; this is the
 * comparable, assumption-fixed number. Commute cost only counts when the search
 * actually has a commute (remote / saved snapshots → 0).
 */
export function allInMonthlyCost(
  scored: ScoredListing,
  a: TrueCostAssumptions = DEFAULT_ASSUMPTIONS
): number {
  const oneWay = scored.commuteApplies ? scored.commuteMinutes : 0;
  return trueMonthlyCost(scored.listing.rentMonthly, scored.listing.bedrooms, scored.commuteMode, oneWay, a).total;
}
