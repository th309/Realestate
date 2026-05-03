import { Test } from '@nestjs/testing';
import { AnonymousController } from '../anonymous.controller';
import { ListingPresentationService } from '../listing-presentation.service';
import { RedisTourCacheService } from '../redis-tour-cache.service';
import { AnonRateLimitGuard } from '../anon-rate-limit.guard';

describe('AnonymousController', () => {
  let controller: AnonymousController;
  let listing: jest.Mocked<ListingPresentationService>;
  let cache: jest.Mocked<RedisTourCacheService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [AnonymousController],
      providers: [
        {
          provide: ListingPresentationService,
          useValue: {
            generate: jest.fn().mockResolvedValue({
              reportId: 'anon-rpt-test',
              sessionId: 'sess-1',
              watermark: 'PropertyIQ Demo · Sign up free to remove',
              expiresAt: '2030-01-01T00:00:00Z',
              claimable: true,
              report: { sections: [] },
            }),
          },
        },
        {
          provide: RedisTourCacheService,
          useValue: { set: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    })
      .overrideGuard(AnonRateLimitGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(AnonymousController);
    listing = module.get(ListingPresentationService);
    cache = module.get(RedisTourCacheService);
  });

  const validDto = {
    sessionId: 'sess-1-12345',
    persona: 'agent' as const,
    market: { geoLevel: 'city', geoId: 'cary-nc', name: 'Cary, NC' },
  };

  it('generates a report and caches it under the session id', async () => {
    const result = await controller.generate(validDto);
    expect(result.reportId).toBe('anon-rpt-test');
    expect(listing.generate).toHaveBeenCalledWith({
      sessionId: validDto.sessionId,
      persona: validDto.persona,
      market: validDto.market,
    });
    expect(cache.set).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'sess-1',
        reportId: 'anon-rpt-test',
        persona: 'agent',
        claimedBy: null,
      }),
    );
  });

  it('returns the report even when cache.set throws (cache failure does not burn rate-limit)', async () => {
    cache.set.mockRejectedValueOnce(new Error('redis connection refused'));
    const result = await controller.generate(validDto);
    expect(result.reportId).toBe('anon-rpt-test');
    expect(listing.generate).toHaveBeenCalledTimes(1);
  });

  it('passes the result.expiresAt through to the cache row', async () => {
    await controller.generate(validDto);
    expect(cache.set).toHaveBeenCalledWith(
      expect.objectContaining({ expiresAt: '2030-01-01T00:00:00Z' }),
    );
  });

  it('sets claimedBy: null at cache write (claim happens later in /auth/sign-up)', async () => {
    await controller.generate(validDto);
    const call = cache.set.mock.calls[0][0];
    expect(call.claimedBy).toBeNull();
  });
});
