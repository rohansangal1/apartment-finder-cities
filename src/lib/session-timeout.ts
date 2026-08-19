/**
 * Session expiry policy — how long a signed-in session may live.
 *
 * Supabase alone gives you no timeout. `autoRefreshToken` renews the access
 * token indefinitely, so the one-hour JWT expiry is not a session limit: the
 * refresh token silently mints a new one. A laptop left open in a coffee shop
 * stays signed in for as long as the refresh token is valid.
 *
 * Two independent limits, because they stop different things:
 *   - idle: you walked away. Measured from the last real interaction.
 *   - absolute: the session is simply too old to keep trusting, however active
 *     it's been. This is the one that bounds a stolen token's usefulness.
 *
 * The marks live in localStorage rather than in memory so the policy survives a
 * reload — an in-memory timer resets every time the tab is refreshed, which
 * makes the timeout trivially defeatable and is the usual way this gets built
 * wrong. Note the honest limit of that: localStorage is writable by any script
 * on the origin, so this is a session-hygiene control, not an attacker-proof
 * one. The token being in localStorage at all is the deeper issue (see README).
 *
 * The pure functions here are the whole policy; auth-context.tsx only supplies
 * the clock and the sign-out.
 */

/** Signed out after this long with no interaction. */
export const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

/** Signed out this long after signing in, active or not. */
export const ABSOLUTE_TIMEOUT_MS = 12 * 60 * 60 * 1000; // 12 hours

const STORAGE_KEY = 'nestle.session.v1';

/** When the session began, and when it last saw the user. */
export interface SessionMarks {
  startedAt: number;
  lastActivityAt: number;
}

export type ExpiryReason = 'idle' | 'absolute';

/**
 * Which limit (if any) the session has passed. Absolute wins when both have,
 * because it's the stronger statement about why the session ended.
 */
export function expiryReason(now: number, marks: SessionMarks): ExpiryReason | null {
  if (now - marks.startedAt >= ABSOLUTE_TIMEOUT_MS) return 'absolute';
  if (now - marks.lastActivityAt >= IDLE_TIMEOUT_MS) return 'idle';
  return null;
}

/** What the user is told after being signed out. */
export function expiryMessage(reason: ExpiryReason): string {
  return reason === 'idle'
    ? 'You were signed out after 30 minutes of inactivity.'
    : 'Your session reached its 12-hour limit. Please sign in again.';
}

/**
 * Read the stored marks, or null if absent/corrupt.
 *
 * Anything unreadable is treated as absent rather than repaired. A half-parsed
 * mark would produce a NaN comparison, and `NaN >= timeout` is false — a
 * session that can never expire, which is the exact failure this module exists
 * to prevent. Better to start a fresh window than to trust a broken one.
 */
export function readMarks(): SessionMarks | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SessionMarks>;
    if (!Number.isFinite(parsed.startedAt) || !Number.isFinite(parsed.lastActivityAt)) return null;
    return { startedAt: parsed.startedAt as number, lastActivityAt: parsed.lastActivityAt as number };
  } catch {
    return null;
  }
}

export function writeMarks(marks: SessionMarks): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(marks));
  } catch {
    // Storage full or blocked (private mode). The in-memory timer still runs
    // for this tab; losing durability is better than breaking sign-in.
  }
}

export function clearMarks(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* nothing useful to do */
  }
}

/**
 * The marks a session should carry right now.
 *
 * Reuses the stored `startedAt` when one exists, so the absolute limit is
 * measured from the real sign-in and not reset by a page reload.
 */
export function beginOrResume(now: number): SessionMarks {
  const existing = readMarks();
  return { startedAt: existing?.startedAt ?? now, lastActivityAt: now };
}
