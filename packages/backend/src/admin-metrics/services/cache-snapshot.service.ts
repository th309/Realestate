/**
 * CacheSnapshotService
 *
 * Reads hit/miss stats from RedisService and, when Redis is available,
 * queries memory usage and key count via INFO/DBSIZE commands.
 * Callers persist the resulting row to admin_cache_metrics.
 */

import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';

export interface CacheSnapshotRow {
  hit_count: number;
  miss_count: number;
  hit_rate: number;
  eviction_count: number;
  memory_used_bytes: number;
  keys_count: number;
}

@Injectable()
export class CacheSnapshotService {
  private readonly logger = new Logger(CacheSnapshotService.name);

  constructor(private readonly redisService: RedisService) {}

  async buildCacheSnapshotRow(): Promise<CacheSnapshotRow> {
    const stats = this.redisService.getStats();
    let memoryUsedBytes = 0;
    let keysCount = 0;

    if (this.redisService.isAvailable()) {
      const redisInfo = await this.readRedisMemoryInfo();
      memoryUsedBytes = redisInfo.memoryUsedBytes;
      keysCount = redisInfo.keysCount;
    }

    return {
      hit_count: stats.hits,
      miss_count: stats.misses,
      // RedisService.getStats() reports hitRate as a percentage (0..100), but
      // admin_cache_metrics.hit_rate is stored as a fraction (0..1) — the
      // contract every reader assumes (alert rule `hit_rate < 0.7`, the admin
      // card's `hit_rate * 100` display, and the e2e fixtures). Normalize here.
      hit_rate: stats.hitRate / 100,
      eviction_count: 0, // ioredis does not expose eviction count in-process
      memory_used_bytes: memoryUsedBytes,
      keys_count: keysCount,
    };
  }

  /**
   * Fetches memory usage (bytes) and total key count from Redis via
   * the INFO memory and DBSIZE commands. Falls back to zeros on error.
   */
  private async readRedisMemoryInfo(): Promise<{
    memoryUsedBytes: number;
    keysCount: number;
  }> {
    try {
      // RedisService holds the ioredis client as a private field; access it
      // through an internal cast so we can issue raw commands without adding
      // a public method to the shared service.
      const rawClient = (
        this.redisService as unknown as {
          client: import('ioredis').default | null;
        }
      ).client;

      if (!rawClient) return { memoryUsedBytes: 0, keysCount: 0 };

      const [infoRaw, dbSize] = await Promise.all([
        rawClient.info('memory'),
        rawClient.dbsize(),
      ]);

      const memMatch = /used_memory:(\d+)/.exec(infoRaw);
      const memoryUsedBytes = memMatch ? parseInt(memMatch[1], 10) : 0;

      return { memoryUsedBytes, keysCount: dbSize };
    } catch (err) {
      this.logger.warn(
        `[CacheSnapshot] Could not read Redis INFO, falling back to 0: ${err instanceof Error ? err.message : String(err)}`,
      );
      return { memoryUsedBytes: 0, keysCount: 0 };
    }
  }
}
