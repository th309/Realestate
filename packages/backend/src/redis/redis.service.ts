/**
 * Redis Service - v1.0.0
 *
 * Provides Redis caching for Quinn with:
 * - Cache key normalization (fixes JSON order issues)
 * - Tool-specific TTL strategy
 * - Geography name canonicalization
 * - Graceful degradation when Redis unavailable
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  hitRate: number;
}

@Injectable()
export class RedisService implements OnModuleInit {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private available = false;

  // Cache statistics
  private stats = {
    hits: 0,
    misses: 0,
    sets: 0,
  };

  // TTL strategy by domain / tool (in seconds)
  private readonly TTL_MAP: Record<string, number> = {
    // ── Domain-level TTLs (Phase 12 targets) ──
    metric_snapshot: 21600, // 6 hours
    time_series: 21600, // 6 hours
    scores: 21600, // 6 hours
    geojson: 86400, // 24 hours
    market_lists: 43200, // 12 hours
    benchmarks: 21600, // 6 hours
    entitlements: 1800, // 30 minutes (per-tier)
    watchlist: 300, // 5 minutes
    recommendations: 3600, // 1 hour

    // ── Quinn tool-level TTLs ──
    get_rankings: 3600, // 1 hour
    analyze_data: 1800, // 30 minutes
    filter_geographies: 7200, // 2 hours
    compare_to_benchmark: 1800, // 30 minutes
    get_time_series: 3600, // 1 hour
    query_database_table: 1800, // 30 minutes
    default: 1800, // 30 minutes
  };

  // State abbreviation mappings for canonicalization
  private readonly STATE_ABBREV_MAP: Record<string, string> = {
    texas: 'TX',
    california: 'CA',
    florida: 'FL',
    'new york': 'NY',
    arizona: 'AZ',
    'north carolina': 'NC',
    georgia: 'GA',
    tennessee: 'TN',
    colorado: 'CO',
    washington: 'WA',
    ohio: 'OH',
    illinois: 'IL',
    michigan: 'MI',
    virginia: 'VA',
    massachusetts: 'MA',
    pennsylvania: 'PA',
    oregon: 'OR',
    nevada: 'NV',
    utah: 'UT',
    minnesota: 'MN',
  };

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const redisUrl = this.configService.get<string>('REDIS_URL');

    if (!redisUrl || redisUrl.trim() === '') {
      this.logger.warn('[Redis] REDIS_URL not configured - falling back to in-memory cache');
      this.available = false;
      return;
    }

    try {
      this.logger.log(`[Redis] Connecting to Redis...`);
      this.client = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => {
          if (times > 3) {
            this.logger.error('[Redis] Max retries reached, giving up');
            return null;
          }
          const delay = Math.min(times * 100, 2000);
          this.logger.warn(`[Redis] Retry attempt ${times}, waiting ${delay}ms`);
          return delay;
        },
      });

      // Test connection
      await this.client.ping();
      this.available = true;
      this.logger.log('[Redis] ✓ Connected successfully');

      // Handle errors
      this.client.on('error', (err) => {
        this.logger.error(`[Redis] Error: ${err.message}`);
        this.available = false;
      });

      this.client.on('reconnecting', () => {
        this.logger.log('[Redis] Reconnecting...');
      });

      this.client.on('ready', () => {
        this.logger.log('[Redis] Ready');
        this.available = true;
      });
    } catch (error) {
      this.logger.error(`[Redis] Failed to connect: ${error.message}`);
      this.available = false;
    }
  }

  /**
   * Check if Redis is available
   */
  isAvailable(): boolean {
    return this.available && this.client !== null;
  }

  /**
   * Get cached value for a tool call
   */
  async get(toolName: string, args: Record<string, any>): Promise<any | null> {
    if (!this.isAvailable() || !this.client) {
      this.stats.misses++;
      return null;
    }

    try {
      const key = this.buildCacheKey(toolName, args);
      const cached = await this.client.get(key);

      if (cached) {
        this.stats.hits++;
        this.logger.log(`[Redis Cache] HIT for ${toolName} (hit rate: ${this.getHitRate()}%)`);
        return JSON.parse(cached);
      }

      this.stats.misses++;
      return null;
    } catch (error) {
      this.logger.error(`[Redis Cache] Get error: ${error.message}`);
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Set cached value for a tool call with appropriate TTL
   */
  async set(toolName: string, args: Record<string, any>, value: any): Promise<void> {
    if (!this.isAvailable() || !this.client) {
      return;
    }

    try {
      const key = this.buildCacheKey(toolName, args);
      const ttl = this.TTL_MAP[toolName] || this.TTL_MAP.default;

      await this.client.setex(key, ttl, JSON.stringify(value));
      this.stats.sets++;
      this.logger.log(`[Redis Cache] SET ${toolName} (TTL: ${ttl}s)`);
    } catch (error) {
      this.logger.error(`[Redis Cache] Set error: ${error.message}`);
    }
  }

  /**
   * Build normalized cache key from tool name and parameters
   * Fixes JSON order-dependent issues by sorting keys and canonicalizing values
   */
  buildCacheKey(toolName: string, args: Record<string, any>): string {
    const normalized = this.normalizeParams(args);
    const paramStr = JSON.stringify(normalized);
    return `quinn:v1:tool:${toolName}:${paramStr}`;
  }

  /**
   * Normalize parameters for consistent cache keys
   * - Sort object keys
   * - Canonicalize geography names (TX = Texas)
   * - Sort arrays
   * - Omit undefined/null defaults
   */
  private normalizeParams(params: Record<string, any>): any {
    if (params === null || params === undefined) {
      return {};
    }

    if (Array.isArray(params)) {
      return params.map((p) => this.normalizeParams(p)).sort();
    }

    if (typeof params === 'object') {
      const normalized: Record<string, any> = {};
      const sortedKeys = Object.keys(params).sort();

      for (const key of sortedKeys) {
        const value = params[key];

        // Skip undefined, null, empty strings, and default values
        if (value === undefined || value === null || value === '') {
          continue;
        }

        // Skip default boolean values
        if (key === 'ascending' && value === false) continue;
        if (key === 'limit' && value === 10) continue;

        // Canonicalize state names/abbreviations
        if (key === 'states' && Array.isArray(value)) {
          normalized[key] = value.map((s) => this.canonicalizeState(s)).sort();
        } else if (typeof value === 'object') {
          normalized[key] = this.normalizeParams(value);
        } else if (typeof value === 'string' && this.isStateName(value)) {
          normalized[key] = this.canonicalizeState(value);
        } else {
          normalized[key] = value;
        }
      }

      return normalized;
    }

    return params;
  }

  /**
   * Canonicalize state name to abbreviation (Texas -> TX)
   */
  private canonicalizeState(state: string): string {
    if (!state || typeof state !== 'string') return state;

    const lower = state.toLowerCase().trim();

    // Already an abbreviation
    if (state.length === 2 && state === state.toUpperCase()) {
      return state;
    }

    // Look up full name
    return this.STATE_ABBREV_MAP[lower] || state;
  }

  /**
   * Check if a string looks like a state name
   */
  private isStateName(str: string): boolean {
    if (!str || typeof str !== 'string') return false;
    const lower = str.toLowerCase().trim();
    return lower in this.STATE_ABBREV_MAP || (str.length === 2 && str === str.toUpperCase());
  }

  /**
   * Get cache hit rate
   */
  private getHitRate(): number {
    const total = this.stats.hits + this.stats.misses;
    if (total === 0) return 0;
    return Math.round((this.stats.hits / total) * 100);
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      sets: this.stats.sets,
      hitRate: total === 0 ? 0 : (this.stats.hits / total) * 100,
    };
  }

  /**
   * Get a raw cached value by key
   */
  async getByKey(key: string): Promise<any | null> {
    if (!this.isAvailable() || !this.client) {
      this.stats.misses++;
      return null;
    }

    try {
      const cached = await this.client.get(key);
      if (cached) {
        this.stats.hits++;
        return JSON.parse(cached);
      }
      this.stats.misses++;
      return null;
    } catch (error) {
      this.logger.error(`[Redis Cache] GetByKey error: ${error.message}`);
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Set a raw cached value by key with a specific TTL (seconds)
   */
  async setByKey(key: string, value: any, ttlSeconds: number): Promise<void> {
    if (!this.isAvailable() || !this.client) {
      return;
    }

    try {
      await this.client.setex(key, ttlSeconds, JSON.stringify(value));
      this.stats.sets++;
    } catch (error) {
      this.logger.error(`[Redis Cache] SetByKey error: ${error.message}`);
    }
  }

  /**
   * Get domain-level TTL (seconds). Falls back to default if domain not found.
   */
  getTTL(domain: string): number {
    return this.TTL_MAP[domain] ?? this.TTL_MAP.default;
  }

  /**
   * Delete all cache keys matching a prefix (e.g. 'entitlements:tier:free:')
   */
  async deleteByPrefix(prefix: string): Promise<number> {
    if (!this.isAvailable() || !this.client) {
      return 0;
    }

    try {
      const keys = await this.client.keys(`${prefix}*`);
      if (keys.length > 0) {
        await this.client.del(...keys);
        this.logger.log(`[Redis Cache] Deleted ${keys.length} keys with prefix "${prefix}"`);
      }
      return keys.length;
    } catch (error) {
      this.logger.error(`[Redis Cache] DeleteByPrefix error: ${error.message}`);
      return 0;
    }
  }

  /**
   * Flush all cache entries (use with caution)
   */
  async flush(): Promise<void> {
    if (!this.isAvailable() || !this.client) {
      return;
    }

    try {
      // Delete only quinn-prefixed keys to avoid affecting other services
      const keys = await this.client.keys('quinn:*');
      if (keys.length > 0) {
        await this.client.del(...keys);
        this.logger.log(`[Redis Cache] Flushed ${keys.length} entries`);
      }
    } catch (error) {
      this.logger.error(`[Redis Cache] Flush error: ${error.message}`);
    }
  }

  /**
   * Close Redis connection (cleanup)
   */
  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit();
      this.logger.log('[Redis] Connection closed');
    }
  }
}
