import { describe, it, expect, beforeEach } from 'vitest';
import {
  ABSOLUTE_TIMEOUT_MS,
  IDLE_TIMEOUT_MS,
  beginOrResume,
  clearMarks,
  expiryMessage,
  expiryReason,
  readMarks,
  writeMarks,
  type SessionMarks,
} from './session-timeout';

const NOW = 1_700_000_000_000;

/** A session that started `age` ago and was last touched `idle` ago. */
const marks = (age: number, idle: number): SessionMarks => ({
  startedAt: NOW - age,
  lastActivityAt: NOW - idle,
});

beforeEach(() => {
  localStorage.clear();
});

describe('expiryReason', () => {
  it('keeps a fresh, active session alive', () => {
    expect(expiryReason(NOW, marks(60_000, 1_000))).toBeNull();
  });

  it('expires a session that has been idle too long', () => {
    expect(expiryReason(NOW, marks(IDLE_TIMEOUT_MS + 1, IDLE_TIMEOUT_MS + 1))).toBe('idle');
  });

  it('expires an old session even while it is being used', () => {
    // Active a second ago, so only the absolute limit can end this one.
    expect(expiryReason(NOW, marks(ABSOLUTE_TIMEOUT_MS + 1, 1_000))).toBe('absolute');
  });

  it('reports the absolute limit when both have been passed', () => {
    const long = ABSOLUTE_TIMEOUT_MS + 1;
    expect(expiryReason(NOW, marks(long, long))).toBe('absolute');
  });

  // Boundary: the limit is inclusive, so exactly-at-the-limit ends the session.
  it('expires exactly at the idle limit, not a tick later', () => {
    expect(expiryReason(NOW, marks(IDLE_TIMEOUT_MS, IDLE_TIMEOUT_MS))).toBe('idle');
    expect(expiryReason(NOW, marks(IDLE_TIMEOUT_MS - 1, IDLE_TIMEOUT_MS - 1))).toBeNull();
  });

  it('explains each reason differently', () => {
    expect(expiryMessage('idle')).toMatch(/inactivity/i);
    expect(expiryMessage('absolute')).toMatch(/12-hour/i);
  });
});

describe('mark storage', () => {
  it('round-trips marks through storage', () => {
    const m = marks(5_000, 1_000);
    writeMarks(m);
    expect(readMarks()).toEqual(m);
  });

  it('returns null when nothing is stored', () => {
    expect(readMarks()).toBeNull();
  });

  it('clears marks', () => {
    writeMarks(marks(5_000, 1_000));
    clearMarks();
    expect(readMarks()).toBeNull();
  });

  // ---- Regression guard ----
  // A NaN timestamp makes every `now - mark >= timeout` comparison false, which
  // is a session that can NEVER expire — the exact opposite of this module's
  // job. Corrupt marks must read as absent so a fresh window starts instead.
  it('treats corrupt marks as absent rather than trusting them', () => {
    localStorage.setItem('nestle.session.v1', '{"startedAt":"nope","lastActivityAt":null}');
    expect(readMarks()).toBeNull();
  });

  it('treats unparseable JSON as absent', () => {
    localStorage.setItem('nestle.session.v1', 'not json at all');
    expect(readMarks()).toBeNull();
  });
});

describe('beginOrResume', () => {
  it('starts a new window when there is no stored session', () => {
    expect(beginOrResume(NOW)).toEqual({ startedAt: NOW, lastActivityAt: NOW });
  });

  // The point of persisting startedAt: reloading the page must not hand the
  // user a fresh 12 hours, or the absolute limit means nothing.
  it('keeps the original start time across a reload', () => {
    writeMarks({ startedAt: NOW - 3_600_000, lastActivityAt: NOW - 3_600_000 });

    expect(beginOrResume(NOW)).toEqual({
      startedAt: NOW - 3_600_000,
      lastActivityAt: NOW,
    });
  });
});
