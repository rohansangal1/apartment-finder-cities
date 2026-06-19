/**
 * Durable cache abstraction. These external APIs bill per call, so we cache
 * aggressively (the plan's #2 reason for a backend):
 *   - geocoded addresses → effectively forever (coordinates never change)
 *   - commute times keyed by (originHash, listingId, mode) → long TTL
 *   - ratings per building → ~1 week TTL
 *
 * Backend selection is automatic:
 *   - If UPSTASH_REDIS_REST_URL + _TOKEN are set → Upstash Redis (durable,
 *     shared across all serverless invocations). Recommended for production.
 *   - Otherwise → an in-process Map. Fine for `vercel dev` and tests, but NOT
 *     shared across cold starts, so it won't actually cut prod spend on its own.
 */
import { Redis } from '@upstash/redis';
import { optionalEnv } from './env';

export interface Cache {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
}

/** Cache TTLs in seconds. Geocode "never" is a very long TTL, not literal infinity. */
export const TTL = {
  geocode: 60 * 60 * 24 * 365, // ~1 year
  commute: 60 * 60 * 24 * 14, // 2 weeks
  rating: 60 * 60 * 24 * 7, // 1 week
  listings: 60 * 60 * 6, // 6 hours (inventory turns over)
} as const;

class RedisCache implements Cache {
  constructor(private redis: Redis) {}
  async get<T>(key: string): Promise<T | null> {
    return (await this.redis.get<T>(key)) ?? null;
  }
  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) await this.redis.set(key, value, { ex: ttlSeconds });
    else await this.redis.set(key, value);
  }
}

class MemoryCache implements Cache {
  private store = new Map<string, { value: unknown; expiresAt: number | null }>();
  async get<T>(key: string): Promise<T | null> {
    const hit = this.store.get(key);
    if (!hit) return null;
    if (hit.expiresAt && Date.now() > hit.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return hit.value as T;
  }
  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    this.store.set(key, {
      value,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
    });
  }
}

let cacheSingleton: Cache | null = null;

export function getCache(): Cache {
  if (cacheSingleton) return cacheSingleton;

  const url = optionalEnv('UPSTASH_REDIS_REST_URL');
  const token = optionalEnv('UPSTASH_REDIS_REST_TOKEN');
  cacheSingleton =
    url && token ? new RedisCache(new Redis({ url, token })) : new MemoryCache();
  return cacheSingleton;
}

/**
 * Read-through cache helper: return the cached value, or run `fetcher`, cache
 * its result, and return it. Centralizes the get/miss/set dance.
 */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const cache = getCache();
  const hit = await cache.get<T>(key);
  if (hit !== null) return hit;
  const fresh = await fetcher();
  await cache.set(key, fresh, ttlSeconds);
  return fresh;
}

/** Stable hash for cache keys (e.g. hashing an origin address). */
export function hashKey(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) h = (h * 33) ^ input.charCodeAt(i);
  return (h >>> 0).toString(36);
}
