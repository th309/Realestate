import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

const BOT_UA =
  /(curl|wget|HeadlessChrome|Bot|Crawler|Spider|httpclient|python-requests)/i;
const TTL_SECONDS = 24 * 60 * 60;

@Injectable()
export class AnonRateLimitGuard implements CanActivate {
  constructor(private redis: RedisService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const ua = String(req.headers['user-agent'] ?? '');
    const ip =
      String(req.headers['x-forwarded-for'] ?? '')
        .split(',')[0]
        ?.trim() ||
      req.socket?.remoteAddress ||
      'unknown';

    if (!ua || BOT_UA.test(ua)) {
      throw new HttpException(
        { error: 'forbidden', code: 'BOT_DETECTED' },
        HttpStatus.FORBIDDEN,
      );
    }

    const key = `anon_rpt:${ip}`;
    const client = (this.redis as any).client;
    const count = await client.incr(key);
    if (count === 1) {
      await client.expire(key, TTL_SECONDS);
    }
    if (count > 1) {
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
