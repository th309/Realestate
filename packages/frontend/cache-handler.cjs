/**
 * Bounded in-memory cache handler for Next.js (self-hosted standalone on Railway).
 *
 * WHY: Next's default incremental cache writes an unbounded number of files into
 * the container's ephemeral storage — ISR page output, fetch-cache entries, and
 * optimized images — one or more files per unique entry. Across thousands of SEO
 * / market routes this blew Railway's ephemeral-storage FILE-COUNT limit, which
 * force-stopped the container ("exceeding maximum number of files allowed in
 * ephemeral storage") and took the site down.
 *
 * This handler keeps the entire server cache in process memory with a hard entry
 * cap + LRU eviction, so the on-disk file count stays at ZERO and memory stays
 * bounded. Paired with `cacheMaxMemorySize: 0` in next.config to disable Next's
 * default (disk-backed) cache.
 *
 * Trade-offs: cache is per-process — it is cold after a deploy/restart (pages
 * regenerate on first hit) and is NOT shared across replicas. The frontend runs
 * a single replica, so that is fine. If we ever scale to multiple replicas,
 * switch this to a shared store (e.g. Redis) for cross-replica consistency.
 *
 * Tune the cap via NEXT_CACHE_MAX_ENTRIES (default 2000).
 */

const MAX_ENTRIES = Number(process.env.NEXT_CACHE_MAX_ENTRIES) || 2000;

// Module-level Map persists for the life of the process. Insertion order is the
// LRU order: oldest key is first, most-recently-used is last.
const cache = new Map();

module.exports = class InMemoryLruCacheHandler {
  constructor(options) {
    this.options = options;
  }

  async get(key) {
    const entry = cache.get(key);
    if (entry === undefined) return undefined;
    // LRU bump: re-insert so this key becomes most-recently-used.
    cache.delete(key);
    cache.set(key, entry);
    return entry;
  }

  async set(key, data, ctx) {
    if (cache.has(key)) cache.delete(key);
    cache.set(key, {
      value: data,
      lastModified: Date.now(),
      tags: (ctx && ctx.tags) || [],
    });
    // Evict least-recently-used entries until back under the cap.
    while (cache.size > MAX_ENTRIES) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey === undefined) break;
      cache.delete(oldestKey);
    }
  }

  async revalidateTag(tags) {
    const tagList = [tags].flat();
    if (tagList.length === 0) return;
    for (const [key, entry] of cache) {
      if (entry.tags && entry.tags.some((tag) => tagList.includes(tag))) {
        cache.delete(key);
      }
    }
  }

  // Per-request scratch cache reset hook — no-op for this implementation.
  resetRequestCache() {}
};
