/**
 * Shared endpoint wrapper: applies rate limiting, normalizes errors to JSON +
 * status codes, sets permissive CORS for the SPA, and gives each handler a clean
 * `(req) => data` shape instead of juggling res plumbing.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { HttpError } from './env';
import { enforceRateLimit } from './rateLimit';

/** Any JSON-serializable payload an endpoint returns. */
type Handler = (req: VercelRequest) => Promise<unknown>;

/** Best-effort client IP from proxy headers. */
function clientIp(req: VercelRequest): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string') return fwd.split(',')[0].trim();
  if (Array.isArray(fwd)) return fwd[0];
  return req.socket?.remoteAddress || 'unknown';
}

export function withHandler(method: 'GET' | 'POST', fn: Handler) {
  return async (req: VercelRequest, res: VercelResponse) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    if (req.method !== method) {
      res.status(405).json({ error: `Method not allowed. Use ${method}.` });
      return;
    }

    try {
      await enforceRateLimit(clientIp(req));
      const data = await fn(req);
      res.status(200).json(data);
    } catch (err) {
      const status = err instanceof HttpError ? err.status : 500;
      const message =
        err instanceof Error ? err.message : 'Unexpected server error.';
      if (status >= 500) console.error(err);
      res.status(status).json({ error: message });
    }
  };
}
