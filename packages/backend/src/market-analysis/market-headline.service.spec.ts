import { MarketHeadlineService } from './market-headline.service';
import type { HeadlineRequest } from './market-headline-prompt';

const request: HeadlineRequest = {
  geoType: 'metro',
  geoId: '12420',
  geoName: 'Austin, TX',
  audience: 'homebuyer',
  metrics: { home_value: { value: 455000, formatted: '$455K', change: 3.1 } },
  scores: { propertyiq: { score: 62, grade: 'B' } },
};

function makeRedis() {
  const store = new Map<string, unknown>();
  return {
    getByKey: jest.fn(async (k: string) => store.get(k) ?? null),
    setByKey: jest.fn(async (k: string, v: unknown) => {
      store.set(k, v);
    }),
  };
}

describe('MarketHeadlineService', () => {
  it('returns parsed AI headline JSON when AI is available', async () => {
    const redis = makeRedis();
    const reportAi = {
      isAvailable: () => true,
      complete: jest.fn(
        async () =>
          '{"headline":"Prices firming, room to negotiate","summary":"Austin, TX is firming."}',
      ),
    };
    const service = new MarketHeadlineService(reportAi as any, redis as any);

    const result = await service.generateHeadline(request);

    expect(result.headline).toBe('Prices firming, room to negotiate');
    expect(result.summary).toBe('Austin, TX is firming.');
    expect(result.cached).toBe(false);
    expect(reportAi.complete).toHaveBeenCalledTimes(1);
  });

  it('serves the second call from the Redis cache without re-calling AI', async () => {
    const redis = makeRedis();
    const reportAi = {
      isAvailable: () => true,
      complete: jest.fn(async () => '{"headline":"H","summary":"S"}'),
    };
    const service = new MarketHeadlineService(reportAi as any, redis as any);

    await service.generateHeadline(request);
    const second = await service.generateHeadline(request);

    expect(second.cached).toBe(true);
    expect(reportAi.complete).toHaveBeenCalledTimes(1);
  });

  it('falls back deterministically when AI is unavailable', async () => {
    const redis = makeRedis();
    const reportAi = { isAvailable: () => false, complete: jest.fn() };
    const service = new MarketHeadlineService(reportAi as any, redis as any);

    const result = await service.generateHeadline(request);

    expect(reportAi.complete).not.toHaveBeenCalled();
    expect(result.summary).toContain('Austin, TX');
    expect(result.headline.length).toBeGreaterThan(0);
  });

  it('falls back deterministically when the AI response cannot be parsed', async () => {
    const redis = makeRedis();
    const reportAi = {
      isAvailable: () => true,
      complete: jest.fn(async () => 'not json at all'),
    };
    const service = new MarketHeadlineService(reportAi as any, redis as any);

    const result = await service.generateHeadline(request);

    expect(result.summary).toContain('Austin, TX');
  });
});
