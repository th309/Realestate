/**
 * Redis Lock Service
 *
 * Distributed locking for cron jobs and other cross-instance coordination.
 * Uses atomic SET NX EX to prevent multiple instances from running
 * the same job simultaneously.
 */

import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from './redis.service';

@Injectable()
export class RedisLockService {
  private readonly logger = new Logger(RedisLockService.name);

  constructor(private readonly redis: RedisService) {}

  /**
   * Acquire a distributed lock using Redis SET NX EX (atomic).
   * Returns true if lock was acquired, false if another instance holds it.
   * Lock auto-expires after ttlSeconds to prevent deadlocks.
   */
  async acquireLock(lockKey: string, ttlSeconds: number): Promise<boolean> {
    if (!this.redis.isAvailable()) {
      // No Redis → allow execution (single-instance fallback)
      return true;
    }

    try {
      const result = await this.redis.setNx(
        `lock:${lockKey}`,
        Date.now().toString(),
        ttlSeconds,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `[Redis Lock] Acquire error for ${lockKey}: ${error.message}`,
      );
      // On error, allow execution to avoid silently skipping crons
      return true;
    }
  }

  /**
   * Release a distributed lock.
   */
  async releaseLock(lockKey: string): Promise<void> {
    if (!this.redis.isAvailable()) {
      return;
    }

    try {
      await this.redis.deleteKey(`lock:${lockKey}`);
    } catch (error) {
      this.logger.error(
        `[Redis Lock] Release error for ${lockKey}: ${error.message}`,
      );
    }
  }
}
