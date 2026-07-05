/**
 * Affordability lens — a pure helper that expresses rent as a share of the user's
 * monthly income against the common "30% rule". This is a *lens* layered on top of
 * results, not a fifth scoring dimension: it never changes the match score, it
 * only annotates listings when the user opts in by providing an income.
 */

export type AffordabilityBand = 'comfortable' | 'stretch' | 'over';

export interface AffordabilityInfo {
  /** Rent as a whole-number percentage of monthly income. */
  pct: number;
  band: AffordabilityBand;
  /** True when at/under the 30% rule. */
  withinRule: boolean;
  /** Short badge text. */
  label: string;
  /** Tailwind classes for the badge (dark-theme friendly). */
  className: string;
}

/**
 * @param rent monthly rent
 * @param monthlyIncome monthly take-home; undefined/≤0 turns the lens off (null)
 */
export function affordability(rent: number, monthlyIncome?: number): AffordabilityInfo | null {
  if (!monthlyIncome || monthlyIncome <= 0) return null;
  const pct = Math.round((rent / monthlyIncome) * 100);

  if (pct <= 30) {
    return {
      pct,
      band: 'comfortable',
      withinRule: true,
      label: `${pct}% of income`,
      className: 'bg-brand-50 text-brand-700',
    };
  }
  if (pct <= 40) {
    return {
      pct,
      band: 'stretch',
      withinRule: false,
      label: `${pct}% of income`,
      className: 'bg-amber-500/15 text-amber-300',
    };
  }
  return {
    pct,
    band: 'over',
    withinRule: false,
    label: `${pct}% of income`,
    className: 'bg-rose-500/15 text-rose-300',
  };
}
