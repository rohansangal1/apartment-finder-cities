/**
 * POST /api/search — the orchestration endpoint.
 * Body: SearchCriteria. Returns ranked ScoredListing[].
 *
 * Keeps all secret keys server-side and collapses many browser round-trips into
 * one call. Rate-limited + budget-guarded via the shared wrapper + providers.
 */
import type { SearchCriteria } from '../src/lib/types';
import { withHandler } from './_lib/handler';
import { HttpError } from './_lib/env';
import { orchestrateSearch } from './_lib/orchestrate';

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
  };
}

export default withHandler('POST', async (req) => {
  const criteria = parseCriteria(req.body);
  const results = await orchestrateSearch(criteria);
  return { results };
});
