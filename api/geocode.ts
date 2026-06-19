/**
 * GET /api/geocode?address=...  → { lat, lng }
 * Thin, key-protected wrapper over TravelTime geocoding (cached ~forever).
 */
import { withHandler } from './_lib/handler';
import { HttpError } from './_lib/env';
import { geocode } from './_lib/providers/traveltime';

export default withHandler('GET', async (req) => {
  const address = typeof req.query.address === 'string' ? req.query.address : '';
  if (!address.trim()) throw new HttpError(400, 'Query param "address" is required.');
  return await geocode(address);
});
