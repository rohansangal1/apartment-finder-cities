/**
 * Upfront cash needed to move in — the ONE-TIME cost, distinct from true-cost.ts
 * (which is the recurring monthly cost). This is the "do I have enough saved to
 * sign the lease?" number: first month + deposit + broker fee + moving, etc.
 *
 * Like true-cost.ts, this module is pure and uses transparent, rough estimates so
 * the UI can show an honest ballpark, not a false-precision quote.
 *
 * TODO(design): we'll fill in the bodies together. For now the stubs return
 * zeroed values so the app still runs while you implement.
 */

/** The editable assumptions behind a move-in estimate. All user-adjustable. */
export interface MoveInInputs {
  /** How many months of rent the landlord holds as a security deposit (e.g. 1). */
  securityDepositMonths: number;
  /** Some leases require last month's rent up front too. */
  requireLastMonth: boolean;
  /**
   * Broker fee as a percentage of ANNUAL rent (NYC convention is ~15%). Set to 0
   * for no-fee listings. We use % of annual rent rather than a flat months figure
   * because that's how brokers actually quote it.
   */
  brokerFeePct: number;
  /** One-off application / credit-check fee charged by the landlord. */
  applicationFee: number;
  /** Rough cost to physically move (truck, movers, boxes). */
  movingCost: number;
}

/** Sensible starting assumptions. Tune these as we design. */
export const DEFAULT_MOVE_IN_INPUTS: MoveInInputs = {
  securityDepositMonths: 1,
  requireLastMonth: false,
  brokerFeePct: 0, // TODO(design): decide default — 0 (no-fee) or 15 (NYC broker)?
  applicationFee: 50,
  movingCost: 600,
};

/** Every line item that makes up the upfront total, plus the total itself. */
export interface MoveInBreakdown {
  firstMonth: number;
  lastMonth: number;
  securityDeposit: number;
  brokerFee: number;
  applicationFee: number;
  movingCost: number;
  /** Sum of all the line items above. */
  total: number;
}

/**
 * The broker fee in dollars: brokerFeePct% of the ANNUAL rent (rent × 12).
 * Kept separate so it's easy to unit-test and reason about on its own. Note the
 * units: pct is a whole number (15 means 15%), so we divide by 100.
 */
export function brokerFee(rent: number, brokerFeePct: number): number {
  const total = (rent * 12) * (brokerFeePct / 100);
  return Math.round(total);
}

/**
 * Combine every upfront line item into a MoveInBreakdown for a given monthly rent
 * and set of assumptions. First month is always one month's rent; last month is
 * only charged when the lease requires it; the deposit is a multiple of rent.
 */
export function estimateMoveInCost(rent: number, inputs: MoveInInputs): MoveInBreakdown {
  const firstMonth = rent;
  const lastMonth = inputs.requireLastMonth ? rent : 0;
  const securityDeposit = rent * inputs.securityDepositMonths;
  const fee = brokerFee(rent, inputs.brokerFeePct);

  return {
    firstMonth,
    lastMonth,
    securityDeposit,
    brokerFee: fee,
    applicationFee: inputs.applicationFee,
    movingCost: inputs.movingCost,
    total:
      firstMonth +
      lastMonth +
      securityDeposit +
      fee +
      inputs.applicationFee +
      inputs.movingCost,
  };
}

/**
 * How many months of the user's take-home income the upfront total represents —
 * the "cash on hand" reality check that pairs with the monthly affordability lens.
 * Returns null when income is unknown (feature off), mirroring affordability().
 */
export function upfrontMonthsOfIncome(total: number, monthlyIncome?: number): number | null {
  if (!monthlyIncome || monthlyIncome <= 0) return null;
  return Math.round((total / monthlyIncome) * 10) / 10; // one decimal, e.g. 2.4
}
