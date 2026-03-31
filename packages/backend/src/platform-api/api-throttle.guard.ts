/**
 * API Throttle Guard (Redis Sliding Window)
 *
 * Per-API-key rate limiting using fixed-window counters in Redis.
 * Each window is 1 minute wide, keyed by `ratelimit:v1:{keyId}:{windowMinute}`.
 *
 * The guard reads `request.apiKeyOrg` (set by ApiKeyAuthGuard) to determine:
 *   - keyId: unique identifier for the API key
 *   - rateLimitRpm: allowed requests per minute (defaults to 60)
 *
 * On success, attaches `request.rateLimitInfo` for the response interceptor
 * and sets standard rate-limit response headers.
 *
 * On limit exceeded, throws 429 with RATE_LIMIT_EXCEEDED error code.
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  Logger,
} from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

/** TTL for rate-limit counter keys — 120s covers the current + previous window */
const RATE_LIMIT_KEY_TTL_SECONDS = 120;

/** Default requests per minute when org has no explicit limit */
const DEFAULT_RATE_LIMIT_RPM = 60;

@Injectable()
export class ApiThrottleGuard implements CanActivate {
  private readonly logger = new Logger(ApiThrottleGuard.name);

  constructor(private readonly redis: RedisService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const keyData = request.apiKeyOrg;

    // If no API key context (e.g., unauthenticated route), skip throttling
    if (!keyData) return true;

    const windowMinute = Math.floor(Date.now() / 60000);
    const redisKey = `ratelimit:v1:${keyData.keyId}:${windowMinute}`;
    const limit = keyData.rateLimitRpm || DEFAULT_RATE_LIMIT_RPM;
    const resetAt = new Date((windowMinute + 1) * 60000).toISOString();

    // Atomically increment counter — prevents race conditions under concurrency
    const currentCount = await this.redis.incrWithTTL(
      redisKey,
      RATE_LIMIT_KEY_TTL_SECONDS,
    );

    if (currentCount > limit) {
      this.setRateLimitHeaders(response, limit, 0, resetAt);
      response.setHeader('Retry-After', '60');

      this.logger.warn(
        `Rate limit exceeded for key ${keyData.keyId}: ${currentCount}/${limit} rpm`,
      );

      throw new HttpException(
        {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `Rate limit of ${limit} requests per minute exceeded`,
        },
        429,
      );
    }

    const remaining = Math.max(0, limit - currentCount);
    this.setRateLimitHeaders(response, limit, remaining, resetAt);

    // Attach rate limit info for the response envelope interceptor
    request.rateLimitInfo = { limit, remaining, reset_at: resetAt };

    return true;
  }

  /**
   * Set standard rate-limit response headers.
   */
  private setRateLimitHeaders(
    response: any,
    limit: number,
    remaining: number,
    resetAt: string,
  ): void {
    response.setHeader('X-RateLimit-Limit', String(limit));
    response.setHeader('X-RateLimit-Remaining', String(remaining));
    response.setHeader('X-RateLimit-Reset', resetAt);
  }
}
