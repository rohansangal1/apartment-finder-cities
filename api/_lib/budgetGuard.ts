/**
 * Budget guard / circuit breaker. Tracks estimated external-API spend per UTC
 * day and trips once it exceeds DAILY_BUDGET_USD, so a traffic spike (or abuse)
 * can't run up an unbounded bill. When tripped, endpoints stop making paid calls
 * and degrade gracefully (cached data only, or a clear 503).
 *
 * Spend is estimated, not exact — we attribute a rough per-call cost to each
 * provider. The point is a safety ceiling, not accounting.
 */
import { getCache } from './cache';
import { DAILY_BUDGET_USD, HttpError } from './env';

/** Rough per-call cost estimates (USD). Tune to each provider's pricing. */
export const CALL_COST = {
  rentcast: 0.01,
  traveltime: 0.005,
  places: 0.017,
  geocode: 0.005,
} as const;

export type CostKey = keyof typeof CALL_COST;

function todayKey(): string {
  return `spend:${new Date().toISOString().slice(0, 10)}`; // spend:YYYY-MM-DD
}

/** Current estimated spend today. */
export async function getSpendToday(): Promise<number> {
  return (await getCache().get<number>(todayKey())) ?? 0;
}

/** Throw 503 if we're already over budget for the day. Call before paid work. */
export async function assertWithinBudget(): Promise<void> {
  if ((await getSpendToday()) >= DAILY_BUDGET_USD) {
    throw new HttpError(
      503,
      'Daily API budget reached. Live data is paused until tomorrow (UTC) to control costs.'
    );
  }
}

/** Record the estimated cost of N calls to a provider. */
export async function recordSpend(provider: CostKey, count = 1): Promise<void> {
  const cache = getCache();
  const next = (await getSpendToday()) + CALL_COST[provider] * count;
  // Expire after 2 days so the key self-cleans; the date rolls over daily anyway.
  await cache.set(todayKey(), next, 60 * 60 * 48);
}
