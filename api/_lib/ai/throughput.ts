/**
 * Global admission control for notes runs.
 *
 * Gemma's free tier is capped at ~15,000 tokens per minute for the whole
 * project, and a measured notes run costs ~2,500 (two model calls: one to pick
 * tools, one to write). That works out to roughly six runs a minute across ALL
 * users combined — a limit the per-IP daily cap does nothing about, since six
 * different people clicking at once is enough to trip it.
 *
 * So we gate globally rather than per user. A run that arrives with the window
 * full waits a few seconds and tries again, which is what makes this a queue
 * rather than a rate limiter: a burst of clicks comes out the far side slightly
 * slower instead of half of them failing. Only a sustained overload — someone
 * still waiting after the retries — gets turned away.
 *
 * The window is a sorted set keyed by timestamp rather than a counter, because a
 * counter needs decrementing and a function that crashes mid-run would leak its
 * slot forever. Old entries here simply fall out of the window on their own.
 */
import { Redis } from '@upstash/redis';
import { optionalEnv, HttpError } from '../env.js';

/**
 * Runs admitted per rolling minute, project-wide. Five against a ceiling of six
 * leaves headroom for a run that reasons more than usual and costs extra tokens.
 */
const MAX_RUNS_PER_MINUTE = 5;

const WINDOW_MS = 60_000;

/**
 * How long a waiting run keeps trying before giving up. The window is a minute
 * wide, so patience has to be roughly that long — give up after 15s and a run
 * queued behind a full window is refused moments before a slot frees up.
 */
const RETRY_DELAY_MS = 5_000;
const MAX_WAITS = 12; // ≈60s, one full window

interface Window {
  /** Try to claim a slot. True if admitted. */
  tryClaim(now: number): Promise<boolean>;
}

class RedisWindow implements Window {
  constructor(private redis: Redis, private key = 'gemma:runs') {}

  async tryClaim(now: number) {
    const member = `${now}-${Math.random().toString(36).slice(2, 8)}`;
    await this.redis.zadd(this.key, { score: now, member });
    await this.redis.zremrangebyscore(this.key, 0, now - WINDOW_MS);
    // Safety net: if traffic stops, don't leave the key around forever.
    await this.redis.expire(this.key, 300);

    // Admit by RANK, not by count. Counting livelocks: when eight runs arrive
    // together they all see eight, all decide they're over the limit, and all
    // release — so nobody proceeds and the whole burst retries in lockstep.
    // Rank makes the decision per-caller, so the earliest five go through and
    // only the genuine overflow waits.
    const rank = await this.redis.zrank(this.key, member);
    if (rank !== null && rank < MAX_RUNS_PER_MINUTE) return true;
    await this.redis.zrem(this.key, member);
    return false;
  }
}

/** Dev fallback. Correct within one process, which is all `vercel dev` has. */
class MemoryWindow implements Window {
  private starts: number[] = [];

  async tryClaim(now: number) {
    this.starts = this.starts.filter((t) => t > now - WINDOW_MS);
    if (this.starts.length >= MAX_RUNS_PER_MINUTE) return false;
    this.starts.push(now);
    return true;
  }
}

let windowSingleton: Window | null = null;

function getWindow(): Window {
  if (windowSingleton) return windowSingleton;
  const url = optionalEnv('UPSTASH_REDIS_REST_URL');
  const token = optionalEnv('UPSTASH_REDIS_REST_TOKEN');
  windowSingleton =
    url && token ? new RedisWindow(new Redis({ url, token })) : new MemoryWindow();
  return windowSingleton;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Wait for a slot in the global throughput window, then return.
 *
 * `onWait` fires the first time this run has to queue, so the UI can say so
 * rather than looking frozen. Throws 429 if the wait runs out.
 */
export async function awaitModelSlot(onWait?: () => void): Promise<void> {
  const window = getWindow();
  let warned = false;

  for (let attempt = 0; attempt <= MAX_WAITS; attempt++) {
    if (await window.tryClaim(Date.now())) return;

    if (!warned) {
      warned = true;
      onWait?.();
    }
    // Jitter, so a burst that arrives together doesn't retry together forever.
    if (attempt < MAX_WAITS) await sleep(RETRY_DELAY_MS + Math.random() * 2_000);
  }

  throw new HttpError(
    429,
    'AI notes are busy right now — Gemma’s free tier is shared across everyone ' +
      'using the app. Try again in a minute.'
  );
}
