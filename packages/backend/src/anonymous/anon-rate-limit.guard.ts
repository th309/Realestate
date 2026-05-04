import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type Redis from 'ioredis';
import { RedisService } from '../redis/redis.service';

const BOT_UA =
  /(curl|wget|HeadlessChrome|Bot|Crawler|Spider|httpclient|python-requests)/i;
const TTL_SECONDS = 24 * 60 * 60;

@Injectable()
export class AnonRateLimitGuard implements CanActivate {
  constructor(private redis: RedisService) {}

  /**
   * RedisService keeps the ioredis client as a private field. We access it
   * via a typed cast — this matches the existing pattern in
   * `redis-tour-cache.service.ts` and avoids leaking the raw client through
   * a new public method.
   */
  private get client(): Redis {
    return (this.redis as unknown as { client: Redis }).client;
  }

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const res = ctx.switchToHttp().getResponse();
    const ua = String(req.headers['user-agent'] ?? '');

    // Prefer Express's parsed `req.ip` (correct when `trust proxy` is set in
    // main.ts — Railway has 1 edge proxy in front, so req.ip resolves to the
    // RIGHTMOST x-forwarded-for entry, set by the trusted edge). Fall back to
    // the rightmost x-forwarded-for entry directly (defensive for tests/raw
    // adapters), then to the socket peer address.
    const xff = String(req.headers['x-forwarded-for'] ?? '');
    const xffRightmost = xff ? xff.split(',').slice(-1)[0]?.trim() : undefined;
    const ip = req.ip || xffRightmost || req.socket?.remoteAddress || 'unknown';

    if (!ua || BOT_UA.test(ua)) {
      throw new HttpException(
        { error: 'forbidden', code: 'BOT_DETECTED' },
        HttpStatus.FORBIDDEN,
      );
    }

    const key = `anon_rpt:${ip}`;
    const count = await this.client.incr(key);
    if (count === 1) {
      await this.client.expire(key, TTL_SECONDS);
    }
    if (count > 1) {
      // RFC 6585: 429 responses SHOULD include a Retry-After header so that
      // browsers, CDNs, and `curl --retry` honor the cooldown.
      res.setHeader('Retry-After', String(TTL_SECONDS));
      throw new HttpException(
        {
          error: 'rate_limited',
          retryAfter: TTL_SECONDS,
          message:
            'You can try one demo report per day. Sign up free for unlimited.',
          signupUrl: '/auth/sign-up?from=tour-rate-limit',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}
