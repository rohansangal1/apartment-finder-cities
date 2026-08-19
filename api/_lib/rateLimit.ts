/**
 * Per-IP rate limiting for our OWN endpoints, so nobody can hammer a function
 * and burn the external-API budget. Uses a fixed-window counter.
 *
 * Backend mirrors the cache: Upstash (durable, correct across invocations) when
 * configured, else an in-process Map (best-effort for dev).
 */
import { Redis } from '@upstash/redis';
import { optionalEnv, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_SEC, HttpError } from './env.js';

interface Limiter {
  hit(ip: string): Promise<{ allowed: boolean; remaining: number }>;
  /** Increment an arbitrary counter that expires after `ttlSec`. */
  count(key: string, ttlSec: number): Promise<number>;
}

class RedisLimiter implements Limiter {
  constructor(private redis: Redis) {}
  async hit(ip: string) {
    const bucket = Math.floor(Date.now() / 1000 / RATE_LIMIT_WINDOW_SEC);
    const key = `rl:${ip}:${bucket}`;
    const count = await this.redis.incr(key);
    if (count === 1) await this.redis.expire(key, RATE_LIMIT_WINDOW_SEC);
    return { allowed: count <= RATE_LIMIT_MAX, remaining: Math.max(0, RATE_LIMIT_MAX - count) };
  }
  async count(key: string, ttlSec: number) {
    const n = await this.redis.incr(key);
    if (n === 1) await this.redis.expire(key, ttlSec);
    return n;
  }
}

class MemoryLimiter implements Limiter {
  private hits = new Map<string, number>();
  private counters = new Map<string, number>();
  async hit(ip: string) {
    const bucket = Math.floor(Date.now() / 1000 / RATE_LIMIT_WINDOW_SEC);
    const key = `${ip}:${bucket}`;
    const count = (this.hits.get(key) ?? 0) + 1;
    this.hits.set(key, count);
    // Opportunistic cleanup of old buckets.
    if (this.hits.size > 5000) this.hits.clear();
    return { allowed: count <= RATE_LIMIT_MAX, remaining: Math.max(0, RATE_LIMIT_MAX - count) };
  }
  async count(key: string, _ttlSec: number) {
    // No expiry in the dev fallback — the key already carries the day, so old
    // days simply stop being read (and the process is short-lived anyway).
    const n = (this.counters.get(key) ?? 0) + 1;
    this.counters.set(key, n);
    if (this.counters.size > 5000) this.counters.clear();
    return n;
  }
}

let limiterSingleton: Limiter | null = null;

function getLimiter(): Limiter {
  if (limiterSingleton) return limiterSingleton;
  const url = optionalEnv('UPSTASH_REDIS_REST_URL');
  const token = optionalEnv('UPSTASH_REDIS_REST_TOKEN');
  limiterSingleton =
    url && token ? new RedisLimiter(new Redis({ url, token })) : new MemoryLimiter();
  return limiterSingleton;
}

/** Throw a 429 if the caller is over their per-window quota. */
export async function enforceRateLimit(ip: string): Promise<void> {
  const { allowed } = await getLimiter().hit(ip || 'unknown');
  if (!allowed) {
    throw new HttpError(429, 'Too many requests. Please slow down and try again shortly.');
  }
}

/**
 * A tighter, per-day cap for one named feature, on top of the global per-window
 * limit. AI notes need this because they draw on a *shared* free-tier model
 * quota — one enthusiastic visitor generating notes all afternoon would leave
 * nothing for anyone else, which the 30-per-minute limit does nothing to stop.
 */
export async function enforceDailyQuota(
  feature: string,
  ip: string,
  max: number,
  message: string
): Promise<void> {
  const day = new Date().toISOString().slice(0, 10);
  const used = await getLimiter().count(`q:${feature}:${ip || 'unknown'}:${day}`, 86_400);
  if (used > max) throw new HttpError(429, message);
}

/**
 * The same counter, keyed on a signed-in user id instead of an IP.
 *
 * Worth having *alongside* the IP caps rather than instead of them, because the
 * two stop different things. An IP is not an identity: it's shared by everyone
 * behind a campus NAT (so an IP cap punishes innocents) and it's a few cents an
 * hour to rotate through a proxy pool (so an IP cap barely inconveniences anyone
 * deliberate). A verified user id is the only key here an attacker can't cycle
 * without paying the cost of creating accounts.
 *
 * `windowSec` picks the shape: 60 for a burst limit, 86_400 for a daily budget.
 * Windows are fixed rather than sliding, matching `enforceRateLimit` — so a
 * caller can land up to 2x `max` across a boundary. That's tolerable because the
 * throughput queue, not this, is what actually protects the model quota.
 */
export async function enforceUserQuota(
  feature: string,
  userId: string,
  max: number,
  windowSec: number,
  message: string
): Promise<void> {
  const bucket = Math.floor(Date.now() / 1000 / windowSec);
  const used = await getLimiter().count(`q:${feature}:u:${userId}:${bucket}`, windowSec);
  if (used > max) throw new HttpError(429, message);
}
