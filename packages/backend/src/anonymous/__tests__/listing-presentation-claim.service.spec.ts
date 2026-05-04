import { Test } from '@nestjs/testing';
import { ListingPresentationClaimService } from '../listing-presentation-claim.service';
import { RedisTourCacheService } from '../redis-tour-cache.service';
import { SupabaseService } from '../../supabase/supabase.service';

describe('ListingPresentationClaimService', () => {
  let service: ListingPresentationClaimService;
  let cache: jest.Mocked<RedisTourCacheService>;
  let supabase: any;
  let insertMock: jest.Mock;
  let selectMock: jest.Mock;
  let upsertMock: jest.Mock;

  beforeEach(async () => {
    selectMock = jest
      .fn()
      .mockResolvedValue({ data: [{ id: 'rpt-row-1' }], error: null });
    insertMock = jest.fn().mockReturnValue({ select: selectMock });
    upsertMock = jest.fn().mockResolvedValue({ data: null, error: null });
    supabase = {
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'reports') return { insert: insertMock };
        if (table === 'user_profiles') return { upsert: upsertMock };
        return {};
      }),
    };

    const module = await Test.createTestingModule({
      providers: [
        ListingPresentationClaimService,
        {
          provide: RedisTourCacheService,
          useValue: {
            get: jest.fn(),
            markClaimed: jest.fn(),
          },
        },
        { provide: SupabaseService, useValue: supabase },
      ],
    }).compile();

    service = module.get(ListingPresentationClaimService);
    cache = module.get(RedisTourCacheService);
  });

  it('claims a session: inserts report row, sets onboarding_market, marks Redis claimed', async () => {
    cache.get.mockResolvedValue({
      sessionId: 'sess-1',
      reportId: 'anon-rpt-1',
      persona: 'agent',
      market: { geoLevel: 'city', geoId: 'cary-nc', name: 'Cary, NC' },
      reportPayload: { sections: [] },
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 86400_000).toISOString(),
      claimedBy: null,
    } as any);

    const result = await service.claim({
      sessionId: 'sess-1',
      userId: 'user-99',
    });

    expect(result).not.toBeNull();
    expect(result!.reportId).toBe('rpt-row-1');
    expect(supabase.from).toHaveBeenCalledWith('reports');
    expect(supabase.from).toHaveBeenCalledWith('user_profiles');
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-99',
        report_type: 'listing_presentation',
        market_geo_level: 'city',
        market_geo_id: 'cary-nc',
        market_name: 'Cary, NC',
        is_demo: false,
        source: 'tour_anonymous_claim',
        anon_session_id: 'sess-1',
      }),
    );
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'user-99',
        onboarding_market: {
          geoLevel: 'city',
          geoId: 'cary-nc',
          name: 'Cary, NC',
        },
      }),
      expect.objectContaining({ onConflict: 'id' }),
    );
    expect(cache.markClaimed).toHaveBeenCalledWith('sess-1', 'user-99');
  });

  it('returns null when sessionId not found in Redis', async () => {
    cache.get.mockResolvedValue(null);
    const result = await service.claim({
      sessionId: 'absent',
      userId: 'user-99',
    });
    expect(result).toBeNull();
    expect(supabase.from).not.toHaveBeenCalled();
    expect(cache.markClaimed).not.toHaveBeenCalled();
  });

  it('throws if session is already claimed by a different user', async () => {
    cache.get.mockResolvedValue({
      sessionId: 'sess-1',
      reportId: 'r',
      persona: 'agent',
      market: { geoLevel: 'city', geoId: 'cary-nc', name: 'Cary, NC' },
      reportPayload: {},
      createdAt: '',
      expiresAt: '',
      claimedBy: 'user-other',
    } as any);
    await expect(
      service.claim({ sessionId: 'sess-1', userId: 'user-99' }),
    ).rejects.toThrow(/already claimed/i);
    expect(supabase.from).not.toHaveBeenCalled();
  });
});
