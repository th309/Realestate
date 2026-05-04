import { ExecutionContext, HttpException } from '@nestjs/common';
import { AnonRateLimitGuard } from '../anon-rate-limit.guard';

describe('AnonRateLimitGuard', () => {
  let guard: AnonRateLimitGuard;
  let redis: any;

  beforeEach(() => {
    redis = {
      incr: jest.fn(),
      expire: jest.fn().mockResolvedValue(1),
    };
    guard = new AnonRateLimitGuard({ client: redis } as any);
  });

  function ctx(ip = '1.2.3.4', ua = 'Mozilla/5.0') {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { 'user-agent': ua, 'x-forwarded-for': ip },
          socket: { remoteAddress: '127.0.0.1' },
        }),
        getResponse: () => ({ setHeader: jest.fn() }),
      }),
    } as ExecutionContext;
  }

  it('allows the first call from an IP', async () => {
    redis.incr.mockResolvedValue(1);
    expect(await guard.canActivate(ctx())).toBe(true);
    expect(redis.expire).toHaveBeenCalledWith('anon_rpt:1.2.3.4', 24 * 60 * 60);
  });

  it('blocks the second call from the same IP within 24h and sets Retry-After', async () => {
    redis.incr.mockResolvedValue(2);
    const setHeader = jest.fn();
    const blockedCtx = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {
            'user-agent': 'Mozilla/5.0',
            'x-forwarded-for': '1.2.3.4',
          },
          socket: { remoteAddress: '127.0.0.1' },
        }),
        getResponse: () => ({ setHeader }),
      }),
    } as ExecutionContext;
    await expect(guard.canActivate(blockedCtx)).rejects.toThrow(HttpException);
    expect(setHeader).toHaveBeenCalledWith('Retry-After', String(24 * 60 * 60));
  });

  it('rejects obvious bot user-agents', async () => {
    redis.incr.mockResolvedValue(1);
    await expect(
      guard.canActivate(ctx('1.2.3.4', 'curl/7.85.0')),
    ).rejects.toThrow(HttpException);
  });

  it('falls back to socket.remoteAddress when x-forwarded-for is missing', async () => {
    redis.incr.mockResolvedValue(1);
    const noXffCtx = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { 'user-agent': 'Mozilla/5.0' },
          socket: { remoteAddress: '5.6.7.8' },
        }),
        getResponse: () => ({ setHeader: jest.fn() }),
      }),
    } as ExecutionContext;
    expect(await guard.canActivate(noXffCtx)).toBe(true);
    expect(redis.expire).toHaveBeenCalledWith('anon_rpt:5.6.7.8', 24 * 60 * 60);
  });
});
