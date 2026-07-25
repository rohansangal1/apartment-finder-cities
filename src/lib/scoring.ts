/**
 * Match scoring — one clear, tweakable pure module.
 *
 * Each sub-score is normalized to 0–100, then combined by the user's
 * (normalized) priority weights. Everything here is a pure function so it can be
 * unit-tested and reasoned about in isolation. Nothing in here touches the
 * network or the DOM.
 */
import type { Listing, SearchCriteria, Weights, SubScores } from './types.js';

/** Max acceptable commute, in minutes, before commute fit hits 0. Tune per mode later. */
export const MAX_COMMUTE = 60;

/** Neutral rating fit for listings with no rating data — sits at neutral, not zero. */
const UNKNOWN_RATING_FIT = 60;

/** Normalize weights so they always sum to 1. Guards against an all-zero object. */
export function normalizeWeights(weights: Weights): Weights {
  const total = Object.values(weights).reduce((a, b) => a + b, 0) || 1;
  return {
    commute: weights.commute / total,
    price: weights.price / total,
    rating: weights.rating / total,
    space: weights.space / total,
  };
}

/**
 * Compute the four 0–100 sub-scores for a listing. Exposed separately so the UI
 * can explain *why* something matched.
 */
export function computeSubScores(
  listing: Listing,
  criteria: SearchCriteria,
  commuteMinutes: number
): SubScores {
  const { maxRent } = criteria;

  // Price fit: how much of the budget the listing leaves unspent. 100 at zero
  // rent, falling linearly to ~5 at the cap; past the cap the same line keeps
  // going, twice as steep, until it clamps at 0.
  //
  // The two halves used to be written on different scales — the over-budget
  // branch restarted from 100 — which put a step in the curve right at the cap:
  // a listing $1 over budget scored ~100 on price while one exactly at budget
  // scored ~5, so going over budget *improved* price fit and over-budget
  // listings systematically outranked affordable ones. Both halves now share the
  // one headroom scale, so the function is continuous and monotonic: more rent
  // is always a worse price fit, with no reward for crossing the cap.
  const headroom = 100 * (1 - listing.rentMonthly / (maxRent * 1.05));
  const overBudgetFraction = Math.max(0, (listing.rentMonthly - maxRent) / maxRent);
  const priceFit = headroom - overBudgetFraction * 200;

  // Commute fit: 100 at 0 min, 0 at the max acceptable commute. Remote = irrelevant.
  const commuteFit = criteria.inPerson
    ? Math.max(0, 100 * (1 - commuteMinutes / MAX_COMMUTE))
    : 100;

  // Rating fit: scale 1–5 to 0–100. Unknown ratings sit at neutral, not zero.
  const ratingFit =
    listing.ratingValue == null ? UNKNOWN_RATING_FIT : (listing.ratingValue / 5) * 100;

  // Space fit: meets or exceeds desired bedrooms = full marks.
  const spaceFit =
    listing.bedrooms >= criteria.bedrooms
      ? 100
      : Math.max(0, 100 - (criteria.bedrooms - listing.bedrooms) * 40);

  return {
    commute: clamp(commuteFit),
    price: clamp(priceFit),
    rating: clamp(ratingFit),
    space: clamp(spaceFit),
  };
}

/**
 * Combine sub-scores by the user's normalized weights into a 0–100 match score.
 * @returns integer 0–100
 */
export function scoreListing(
  listing: Listing,
  criteria: SearchCriteria,
  commuteMinutes: number
): number {
  const sub = computeSubScores(listing, criteria, commuteMinutes);
  const w = normalizeWeights(criteria.weights);

  const score =
    w.commute * sub.commute +
    w.price * sub.price +
    w.rating * sub.rating +
    w.space * sub.space;

  return Math.round(clamp(score));
}

/**
 * Human-readable "why it matched" from whichever sub-scores are highest,
 * weighted by what the user actually cares about (so we don't brag about a
 * dimension they put zero weight on).
 */
export function explainMatch(
  sub: SubScores,
  criteria: SearchCriteria,
  listing: Listing
): string {
  const w = normalizeWeights(criteria.weights);
  const phrases: Record<keyof SubScores, string> = {
    commute: phraseFor(sub.commute, 'a quick commute', 'a manageable commute'),
    price: phraseFor(sub.price, 'well under budget', 'a fair price'),
    rating: phraseFor(sub.rating, 'highly rated', 'solid reviews'),
    space: phraseFor(sub.space, 'plenty of space', 'enough room'),
  };

  // Don't brag about dimensions we can't actually stand behind: commute is only
  // real for in-person searches, and a rating claim needs a known rating (an
  // unknown one sits at a neutral score, which we must not sell as "reviews").
  const earned: Record<keyof SubScores, boolean> = {
    commute: criteria.inPerson,
    price: true,
    rating: listing.ratingValue != null,
    space: true,
  };

  // Rank dimensions by weighted contribution, drop ones the user ignores, that
  // score poorly, or that we haven't earned.
  const keys = Object.keys(phrases) as Array<keyof SubScores>;
  const ranked = keys
    .filter((k) => earned[k] && w[k] > 0.01 && sub[k] >= 50)
    .sort((a, b) => w[b] * sub[b] - w[a] * sub[a])
    .slice(0, 2)
    .map((k) => phrases[k]);

  if (ranked.length === 0) return 'A reasonable overall match for your search.';
  if (ranked.length === 1) return capitalize(`${ranked[0]}.`);
  return capitalize(`${ranked[0]} and ${ranked[1]}.`);
}

function phraseFor(value: number, strong: string, mild: string): string {
  return value >= 80 ? strong : mild;
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, n));
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
