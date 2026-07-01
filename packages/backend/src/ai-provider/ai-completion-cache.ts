/**
 * AI Completion Cache
 *
 * Short-TTL, LRU-bounded in-memory cache for AI completions keyed on the full
 * resolved request (provider + model + prompts + params). Because the key
 * embeds the entire prompt — which itself embeds the market data — identical
 * inputs (same market, same data) reuse the same answer instead of re-billing
 * the provider. This neutralizes the dominant cost pattern of repeatedly
 * regenerating the SAME report while debugging: 50 identical regenerations
 * cost one call instead of fifty.
 *
 * TTL is intentionally short so a genuinely fresh generation after new data
 * lands still misses and regenerates. Only successful, non-empty completions
 * should be cached by callers.
 *
 * CALLER CONTRACT (tenant safety): this is a PROCESS-WIDE singleton shared
 * across all users and organizations. The cache key must fully determine the
 * output, so callers MUST NOT cache prompts that embed user- or tenant-specific
 * data (user id, org id, subscription tier, personalized context) unless that
 * data is part of the key — otherwise one tenant's answer could be served to
 * another. For personalized purposes, bypass the cache (pass cacheKey=null or
 * set AI_COMPLETION_CACHE_TTL_MS=0). Today's cached purposes (market report
 * narratives) are market-level, non-personalized content.
 */

import { createHash } from 'crypto';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export interface AiCompletionCacheOptions {
  /** Time-to-live per entry in ms. Zero or negative disables the cache. */
  ttlMs: number;
  /** Max entries before least-recently-used eviction. Defaults to 500. */
  maxEntries?: number;
  /** Injectable clock (ms since epoch); defaults to Date.now. */
  now?: () => number;
}

export class AiCompletionCache<T = unknown> {
  private readonly ttlMs: number;
  private readonly maxEntries: number;
  private readonly now: () => number;
  // Map preserves insertion order → front = least-recently-used.
  private readonly store = new Map<string, CacheEntry<T>>();

  constructor(opts: AiCompletionCacheOptions) {
    this.ttlMs = opts.ttlMs;
    this.maxEntries = opts.maxEntries ?? 500;
    this.now = opts.now ?? (() => Date.now());
  }

  get enabled(): boolean {
    return this.ttlMs > 0;
  }

  /** Deterministic cache key over the request parts (field-order independent). */
  makeKey(parts: Record<string, unknown>): string {
    const normalized = Object.keys(parts)
      .sort()
      .map((k) => [k, parts[k]]);
    return createHash('sha256')
      .update(JSON.stringify(normalized))
      .digest('hex');
  }

  get(key: string): T | undefined {
    if (this.ttlMs <= 0) return undefined;
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (this.now() >= entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    // Refresh recency: move to the back of the insertion order.
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T): void {
    if (this.ttlMs <= 0) return;
    this.store.delete(key);
    this.store.set(key, { value, expiresAt: this.now() + this.ttlMs });
    while (this.store.size > this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest === undefined) break;
      this.store.delete(oldest);
    }
  }
}
