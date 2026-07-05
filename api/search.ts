/**
 * POST /api/search — the orchestration endpoint.
 * Body: SearchCriteria. Returns ranked ScoredListing[].
 *
 * Keeps all secret keys server-side and collapses many browser round-trips into
 * one call. Rate-limited + budget-guarded via the shared wrapper + providers.
 */
import type { SearchCriteria } from '../src/lib/types.js';
import { withHandler } from './_lib/handler.js';
import { HttpError } from './_lib/env.js';
import { orchestrateSearch } from './_lib/orchestrate.js';

function parseCriteria(body: unknown): SearchCriteria {
  const c = body as Partial<SearchCriteria> | undefined;
  if (!c || typeof c.city !== 'string' || !c.city.trim()) {
    throw new HttpError(400, 'Invalid request: "city" is required.');
  }
  return {
    city: c.city,
    inPerson: Boolean(c.inPerson),
    workAddress: c.workAddress,
    maxRent: Number(c.maxRent) || 0,
    bedrooms: Number(c.bedrooms) || 0,
    commuteMode: c.commuteMode || 'transit',
    weights: c.weights || { commute: 1, price: 1, rating: 1, space: 1 },
    // Trust-boundary rule: the handler re-parses every client field it needs
    // instead of trusting the raw body. That's the right instinct — but it means
    // a field left out here is silently dropped, even though the client sent it.
    // monthlyIncome was missing, so the affordability lens never lit up over the
    // API. Coerce to a number; blank/0/garbage collapse to undefined = feature off.
    monthlyIncome: c.monthlyIncome ? Number(c.monthlyIncome) || undefined : undefined,
  };
}

export default withHandler('POST', async (req) => {
  const criteria = parseCriteria(req.body);
  const results = await orchestrateSearch(criteria);
  return { results };
});
