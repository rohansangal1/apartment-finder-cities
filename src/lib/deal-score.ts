/**
 * Client for the Python Deal Score endpoint (POST /api/deal-score).
 *
 * This is *progressive enhancement*: the app is fully usable without it. We fetch
 * scores after results render and layer badges on top when they arrive. If the
 * endpoint isn't there (plain `vite dev` doesn't run Python functions), errors,
 * or returns nothing for a listing, we show no badge — never an error. So the
 * feature "lights up" on Vercel (where Python runs) and is silently absent on a
 * local mock dev server, with zero branching in the calling components.
 */
import type { Listing } from './types';

/** One listing's deal assessment, as returned by the Python endpoint. */
export interface DealScore {
  /** Percent above (+) or below (−) the group median rent. */
  pctVsMedian: number;
  /** 0–100; fraction of comparables priced at or below this one (lower = cheaper). */
  percentile: number;
  /** Human summary, e.g. "12% below median for 1BRs in Chelsea". */
  label: string;
  /** Which comparison group was used once thin data forced a widen. */
  scope: 'neighborhood' | 'citywide';
  /** How many comparables backed the claim (≥ the endpoint's MIN_GROUP). */
  groupSize: number;
}

const BASE = import.meta.env?.VITE_API_BASE_URL || '';

/**
 * Fetch deal scores for a set of listings, keyed by listing id.
 *
 * Returns `null` on *any* failure (network, non-200, bad JSON) — the caller then
 * simply renders no badges. Only the fields the endpoint needs are sent.
 */
export async function fetchDealScores(
  listings: Listing[]
): Promise<Record<string, DealScore> | null> {
  if (listings.length === 0) return null;
  try {
    const res = await fetch(`${BASE}/api/deal-score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        listings: listings.map((l) => ({
          id: l.id,
          rentMonthly: l.rentMonthly,
          bedrooms: l.bedrooms,
          neighborhood: l.neighborhood,
          city: l.city,
        })),
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { scores?: Record<string, DealScore> };
    return data.scores ?? null;
  } catch {
    // Python functions don't run under plain `vite dev`; degrade silently.
    return null;
  }
}
