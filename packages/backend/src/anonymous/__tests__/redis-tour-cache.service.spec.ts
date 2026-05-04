import { Test } from '@nestjs/testing';
import { RedisTourCacheService } from '../redis-tour-cache.service';
import { RedisService } from '../../redis/redis.service';

describe('RedisTourCacheService', () => {
  let service: RedisTourCacheService;
  let redis: any;

  beforeEach(async () => {
    redis = {
      set: jest.fn().mockResolvedValue('OK'),
      get: jest.fn(),
      del: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
    };
    const module = await Test.createTestingModule({
      providers: [
        RedisTourCacheService,
        { provide: RedisService, useValue: { client: redis } },
      ],
    }).compile();
    service = module.get(RedisTourCacheService);
  });

  it('stores a session with 7-day TTL', async () => {
    const session = {
      sessionId: 'sess-1',
      reportId: 'rpt-1',
      persona: 'agent' as const,
      market: { geoLevel: 'city', geoId: 'cary-nc', name: 'Cary, NC' },
      reportPayload: { sections: [] },
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 86400_000).toISOString(),
      claimedBy: null,
    };
    await service.set(session);
    expect(redis.set).toHaveBeenCalledWith(
      'tour:sess-1',
      expect.any(String),
      'EX',
      7 * 24 * 60 * 60,
    );
  });

  it('reads back a session and parses JSON', async () => {
    redis.get.mockResolvedValue(
      JSON.stringify({ sessionId: 'sess-1', persona: 'agent' }),
    );
    const result = await service.get('sess-1');
    expect(result?.sessionId).toBe('sess-1');
  });

  it('returns null when key missing', async () => {
    redis.get.mockResolvedValue(null);
    expect(await service.get('absent')).toBeNull();
  });

  it('marks claimed and updates atomically', async () => {
    redis.get.mockResolvedValue(
      JSON.stringify({
        sessionId: 'sess-1',
        persona: 'agent',
        claimedBy: null,
      }),
    );
    const claimed = await service.markClaimed('sess-1', 'user-99');
    expect(claimed?.claimedBy).toBe('user-99');
    expect(redis.set).toHaveBeenCalledWith(
      'tour:sess-1',
      expect.stringContaining('"claimedBy":"user-99"'),
      'EX',
      expect.any(Number),
    );
  });
});
