/**
 * GET /api/rating?address=&city=  → { value, source }
 * Progressive-hydration endpoint for a building's blended rating. Returns
 * { value: null } when data is too sparse — the UI shows "Not enough info".
 *
 * In Phase 1 the blend is external-only (Google Places); Phase 2 passes the
 * building's first-party reviews into blendRating so platform voices weigh in.
 */
import type { Listing } from '../src/lib/types';
import { withHandler } from './_lib/handler';
import { HttpError } from './_lib/env';
import { blendRating } from './_lib/ratings';

export default withHandler('GET', async (req) => {
  const address = typeof req.query.address === 'string' ? req.query.address : '';
  const city = typeof req.query.city === 'string' ? req.query.city : '';
  if (!address.trim() || !city.trim()) {
    throw new HttpError(400, 'Query params "address" and "city" are required.');
  }
  // Only address + city are needed for the Places lookup; the rest is a stub.
  const stub = { address, city } as Listing;
  return await blendRating(stub);
});
