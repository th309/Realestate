/**
 * In-memory sliding window rate limiter for Next.js API routes.
 *
 * Tracks request timestamps per key (typically an IP address) and enforces
 * a maximum number of requests within a configurable time window. Stale
 * entries are automatically purged on a periodic interval to prevent
 * unbounded memory growth.
 *
 * Usage:
 *   const limiter = new RateLimiter({ maxRequests: 5, windowMs: 15 * 60 * 1000 });
 *   const result = limiter.check(clientIp);
 *   if (result.limited) { return 429 with Retry-After: result.retryAfterSeconds }
 */

interface RateLimiterConfig {
  /** Maximum requests allowed within the window. */
  maxRequests: number;
  /** Window duration in milliseconds. */
  windowMs: number;
  /** How often to sweep stale entries (ms). Defaults to 5 minutes. */
  cleanupIntervalMs?: number;
}

interface RateLimitResult {
  /** Whether the request should be rejected. */
  limited: boolean;
  /** Seconds until the client can retry (0 when not limited). */
  retryAfterSeconds: number;
  /** How many requests remain in the current window. */
  remaining: number;
}

class RateLimiter {
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private readonly store: Map<string, number[]> = new Map();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: RateLimiterConfig) {
    this.maxRequests = config.maxRequests;
    this.windowMs = config.windowMs;

    const cleanupIntervalMs = config.cleanupIntervalMs ?? 5 * 60 * 1000;
    this.cleanupTimer = setInterval(() => this.cleanup(), cleanupIntervalMs);

    // Allow the Node process to exit even if the timer is still active.
    if (
      this.cleanupTimer &&
      typeof this.cleanupTimer === "object" &&
      "unref" in this.cleanupTimer
    ) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Check whether a key (e.g. IP address) is rate-limited.
   *
   * This uses a sliding window: only timestamps within the last `windowMs`
   * milliseconds count toward the limit.
   */
  check(key: string): RateLimitResult {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Get existing timestamps and prune those outside the window.
    const timestamps = (this.store.get(key) ?? []).filter(
      (t) => t > windowStart,
    );

    if (timestamps.length >= this.maxRequests) {
      // The oldest timestamp still inside the window determines when the
      // client can next make a request (once it slides out of the window).
      const oldestInWindow = timestamps[0];
      const retryAfterMs = oldestInWindow + this.windowMs - now;
      const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);

      // Persist pruned list (don't keep growing).
      this.store.set(key, timestamps);

      return {
        limited: true,
        retryAfterSeconds: Math.max(retryAfterSeconds, 1),
        remaining: 0,
      };
    }

    // Record this request.
    timestamps.push(now);
    this.store.set(key, timestamps);

    return {
      limited: false,
      retryAfterSeconds: 0,
      remaining: this.maxRequests - timestamps.length,
    };
  }

  /** Remove entries whose newest timestamp is older than the window. */
  private cleanup(): void {
    const cutoff = Date.now() - this.windowMs;
    for (const [key, timestamps] of this.store) {
      // If the most recent request is outside the window, the entire
      // entry is stale and can be dropped.
      if (
        timestamps.length === 0 ||
        timestamps[timestamps.length - 1] <= cutoff
      ) {
        this.store.delete(key);
      }
    }
  }

  /** Tear down the cleanup timer (useful for tests). */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}

export { RateLimiter };
export type { RateLimiterConfig, RateLimitResult };
