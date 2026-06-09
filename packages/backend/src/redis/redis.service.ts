/**
 * Redis Service — caching with graceful degradation when Redis unavailable.
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { buildCacheKey } from './redis-cache-key';
import { TTL_MAP } from './redis-ttl-config';

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

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const redisUrl = this.configService.get<string>('REDIS_URL');

    if (!redisUrl || redisUrl.trim() === '') {
      this.logger.warn(
        '[Redis] REDIS_URL not configured - falling back to in-memory cache',
      );
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
          this.logger.warn(
            `[Redis] Retry attempt ${times}, waiting ${delay}ms`,
          );
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
   * Returns the underlying ioredis client when Redis is available, or `null`
   * when REDIS_URL is unset or the connection has failed.
   *
   * Prefer the high-level `get`/`set`/`incrWithTTL` helpers above for caching.
   * This accessor exists for callers that need raw ioredis primitives (e.g.
   * `INCR`/`EXPIRE` for monthly rate-limit counters) and that want to fail
   * closed when Redis is unavailable rather than silently degrade.
   */
  getClient(): Redis | null {
    return this.isAvailable() ? this.client : null;
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
        this.logger.log(
          `[Redis Cache] HIT for ${toolName} (hit rate: ${this.getHitRate()}%)`,
        );
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
  async set(
    toolName: string,
    args: Record<string, any>,
    value: any,
  ): Promise<void> {
    if (!this.isAvailable() || !this.client) {
      return;
    }

    try {
      const key = this.buildCacheKey(toolName, args);
      const ttl = TTL_MAP[toolName] || TTL_MAP.default;

      await this.client.setex(key, ttl, JSON.stringify(value));
      this.stats.sets++;
      this.logger.log(`[Redis Cache] SET ${toolName} (TTL: ${ttl}s)`);
    } catch (error) {
      this.logger.error(`[Redis Cache] Set error: ${error.message}`);
    }
  }

  /**
   * Build normalized cache key (delegates to redis-cache-key utility).
   */
  buildCacheKey(toolName: string, args: Record<string, any>): string {
    return buildCacheKey(toolName, args);
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
   * Atomically increment a key and set TTL on first creation.
   * Returns the new count. Used for rate limiting.
   */
  async incrWithTTL(key: string, ttlSeconds: number): Promise<number> {
    if (!this.isAvailable() || !this.client) {
      return 0; // Fail open
    }

    try {
      const count = await this.client.incr(key);
      if (count === 1) {
        await this.client.expire(key, ttlSeconds);
      }
      return count;
    } catch (error) {
      this.logger.error(`[Redis Cache] IncrWithTTL error: ${error.message}`);
      return 0;
    }
  }

  /**
   * Get domain-level TTL (seconds). Falls back to default if domain not found.
   */
  getTTL(domain: string): number {
    return TTL_MAP[domain] ?? TTL_MAP.default;
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
        this.logger.log(
          `[Redis Cache] Deleted ${keys.length} keys with prefix "${prefix}"`,
        );
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
      // Delete only tool-result cache keys to avoid affecting other services
      const keys = await this.client.keys('tool:v1:*');
      if (keys.length > 0) {
        await this.client.del(...keys);
        this.logger.log(`[Redis Cache] Flushed ${keys.length} entries`);
      }
    } catch (error) {
      this.logger.error(`[Redis Cache] Flush error: ${error.message}`);
    }
  }

  /**
   * Atomic SET if not exists with TTL. Used by RedisLockService.
   */
  async setNx(
    key: string,
    value: string,
    ttlSeconds: number,
  ): Promise<boolean> {
    if (!this.isAvailable() || !this.client) return false;
    const result = await this.client.set(key, value, 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  }

  /**
   * Delete a single key. Used by RedisLockService.
   */
  async deleteKey(key: string): Promise<void> {
    if (!this.isAvailable() || !this.client) return;
    await this.client.del(key);
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
