/**
 * Server-side environment access. These secrets live ONLY in the serverless
 * runtime (Vercel project settings / `.env`) and are never exposed to the
 * browser — that's the whole reason Phase 1 needs a backend.
 *
 * Files/folders under `api/` that start with `_` are NOT routed as functions by
 * Vercel, so this and everything in `_lib/` are shared helpers, not endpoints.
 */

/** Read a required secret; throws a clear error if it's missing at call time. */
export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new HttpError(
      503,
      `Missing required environment variable: ${name}. ` +
        `Set it in your Vercel project (or .env for local \`vercel dev\`).`
    );
  }
  return v;
}

export function optionalEnv(name: string): string | undefined {
  return process.env[name] || undefined;
}

/** Daily spend ceiling (USD). Above this, the budget guard trips. */
export const DAILY_BUDGET_USD = Number(process.env.DAILY_BUDGET_USD || '5');

/** Per-IP request ceiling for our own endpoints, per window. */
export const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX || '30');
export const RATE_LIMIT_WINDOW_SEC = Number(process.env.RATE_LIMIT_WINDOW_SEC || '60');

/**
 * A typed HTTP error the endpoints can throw and the shared handler maps to a
 * status code + JSON body.
 */
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'HttpError';
  }
}
