/**
 * Shared endpoint wrapper: applies rate limiting, normalizes errors to JSON +
 * status codes, sets permissive CORS for the SPA, and gives each handler a clean
 * `(req) => data` shape instead of juggling res plumbing.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { HttpError } from './env.js';
import { enforceRateLimit } from './rateLimit.js';

/** Any JSON-serializable payload an endpoint returns. */
type Handler = (req: VercelRequest) => Promise<unknown>;

/** Writes one named SSE event. Data is JSON-encoded on a single line. */
export type Emit = (event: string, data: unknown) => void;

/** A streaming endpoint: pushes events as it works instead of returning a body. */
type StreamHandler = (req: VercelRequest, emit: Emit) => Promise<void>;

/** Best-effort client IP from proxy headers. */
function clientIp(req: VercelRequest): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string') return fwd.split(',')[0].trim();
  if (Array.isArray(fwd)) return fwd[0];
  return req.socket?.remoteAddress || 'unknown';
}

/**
 * Decide which value to send in `Access-Control-Allow-Origin`.
 *
 * CORS is a *browser* guardrail: it tells a page whether JS on origin A is
 * allowed to read responses from our API on origin B. `*` says "any website may
 * call me" — fine for a fully public, unauthenticated API, but a blunt default.
 *
 * We prefer an *allowlist*: set ALLOWED_ORIGINS in the Vercel dashboard to a
 * comma-separated list (e.g. "https://apt.example.com,https://www.apt.example.com").
 * We then echo the request's Origin back *only if* it's on the list. Echoing the
 * specific origin (rather than "*") is also required if we ever send credentials.
 *
 * When ALLOWED_ORIGINS is unset we fall back to "*" so local dev and previews
 * keep working with zero config — you opt into the stricter behavior per
 * environment by setting the var only where you want it enforced.
 */
function resolveAllowedOrigin(req: VercelRequest): string | null {
  const raw = process.env.ALLOWED_ORIGINS?.trim();
  if (!raw) return '*'; // Unset → permissive default (dev/preview convenience).

  const allowlist = raw.split(',').map((o) => o.trim()).filter(Boolean);
  const origin = req.headers.origin;
  if (typeof origin === 'string' && allowlist.includes(origin)) return origin;

  // Origin missing or not allowlisted → send no ACAO header. The browser then
  // blocks the cross-origin read. (null means "don't set the header".)
  return null;
}

/**
 * CORS + preflight + method check, shared by the JSON and streaming wrappers.
 * Returns false when it has already ended the response and the caller should stop.
 */
function preamble(req: VercelRequest, res: VercelResponse, method: 'GET' | 'POST'): boolean {
  const allowOrigin = resolveAllowedOrigin(req);
  if (allowOrigin) res.setHeader('Access-Control-Allow-Origin', allowOrigin);
  // Because the ACAO value now depends on the incoming Origin, caches (CDN,
  // browser) must key on it too — otherwise one origin's cached response could
  // be replayed for another. `Vary: Origin` tells them exactly that.
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return false;
  }
  if (req.method !== method) {
    res.status(405).json({ error: `Method not allowed. Use ${method}.` });
    return false;
  }
  return true;
}

export function withHandler(method: 'GET' | 'POST', fn: Handler) {
  return async (req: VercelRequest, res: VercelResponse) => {
    if (!preamble(req, res, method)) return;

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

/**
 * Streaming sibling of withHandler: same CORS/method/rate-limit gate, but the
 * endpoint pushes Server-Sent Events as it works instead of returning one body.
 *
 * Why SSE rather than a buffered JSON reply: generating notes takes several
 * seconds of real lookups, and the UI shows each step as it happens. This runs
 * on the default Node runtime — streaming does NOT require the edge runtime.
 *
 * Error handling has two halves. A failure *before* the first event (missing
 * key, rate limit) hasn't committed to a stream yet, so we answer with the same
 * JSON error shape every other endpoint uses. Once bytes are on the wire the
 * status line is already sent, so a failure can only be reported as an `error`
 * event — which the client treats as a failed run.
 */
export function withStreamHandler(method: 'GET' | 'POST', fn: StreamHandler) {
  return async (req: VercelRequest, res: VercelResponse) => {
    if (!preamble(req, res, method)) return;

    let started = false;
    const emit: Emit = (event, data) => {
      if (!started) {
        started = true;
        res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        // Tell any intermediary proxy not to buffer — buffering would defeat
        // the whole point by holding every step until the response completes.
        res.setHeader('X-Accel-Buffering', 'no');
        res.status(200);
      }
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
      await enforceRateLimit(clientIp(req));
      await fn(req, emit);
    } catch (err) {
      const status = err instanceof HttpError ? err.status : 500;
      const message = err instanceof Error ? err.message : 'Unexpected server error.';
      if (status >= 500) console.error(err);
      if (started) {
        // The stream must still be closed after an error event. Leaving it open
        // hangs the client's reader forever — it never sees the end of the body,
        // so a failed run looks like a run that's still going.
        emit('error', { message });
        res.end();
      } else {
        res.status(status).json({ error: message });
      }
      return;
    }
    res.end();
  };
}
