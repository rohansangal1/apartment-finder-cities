/**
 * Per-IP rate limiting for our OWN endpoints, so nobody can hammer a function
 * and burn the external-API budget. Uses a fixed-window counter.
 *
 * Backend mirrors the cache: Upstash (durable, correct across invocations) when
 * configured, else an in-process Map (best-effort for dev).
 */
import { Redis } from '@upstash/redis';
import { optionalEnv, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_SEC, HttpError } from './env';

interface Limiter {
  hit(ip: string): Promise<{ allowed: boolean; remaining: number }>;
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
}

class MemoryLimiter implements Limiter {
  private hits = new Map<string, number>();
  async hit(ip: string) {
    const bucket = Math.floor(Date.now() / 1000 / RATE_LIMIT_WINDOW_SEC);
    const key = `${ip}:${bucket}`;
    const count = (this.hits.get(key) ?? 0) + 1;
    this.hits.set(key, count);
    // Opportunistic cleanup of old buckets.
    if (this.hits.size > 5000) this.hits.clear();
    return { allowed: count <= RATE_LIMIT_MAX, remaining: Math.max(0, RATE_LIMIT_MAX - count) };
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
