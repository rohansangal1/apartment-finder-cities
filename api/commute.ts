/**
 * GET /api/commute?originLat=&originLng=&destLat=&destLng=&mode=
 *   → { minutes, mode }
 * Progressive-hydration endpoint: lets the client fill commute after listings
 * render. Key-protected + cached (long TTL keyed by origin/dest/mode).
 */
import type { CommuteMode } from '../src/lib/types';
import { withHandler } from './_lib/handler';
import { HttpError } from './_lib/env';
import { commute } from './_lib/providers/traveltime';

const MODES: CommuteMode[] = ['walk', 'transit', 'bike', 'drive'];

function num(v: unknown, name: string): number {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new HttpError(400, `Query param "${name}" must be a number.`);
  return n;
}

export default withHandler('GET', async (req) => {
  const q = req.query;
  const mode = (typeof q.mode === 'string' ? q.mode : 'transit') as CommuteMode;
  if (!MODES.includes(mode)) throw new HttpError(400, `Invalid "mode": ${mode}`);

  return await commute(
    { lat: num(q.originLat, 'originLat'), lng: num(q.originLng, 'originLng') },
    { lat: num(q.destLat, 'destLat'), lng: num(q.destLng, 'destLng') },
    mode
  );
});
