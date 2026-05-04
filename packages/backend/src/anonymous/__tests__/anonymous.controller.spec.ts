import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { AnonymousController } from '../anonymous.controller';
import { ListingPresentationService } from '../listing-presentation.service';
import { RedisTourCacheService } from '../redis-tour-cache.service';
import { ListingPresentationClaimService } from '../listing-presentation-claim.service';
import { AnonRateLimitGuard } from '../anon-rate-limit.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SupabaseService } from '../../supabase/supabase.service';

describe('AnonymousController', () => {
  let controller: AnonymousController;
  let listing: jest.Mocked<ListingPresentationService>;
  let cache: jest.Mocked<RedisTourCacheService>;
  let claimService: jest.Mocked<ListingPresentationClaimService>;
  let supabaseAdmin: {
    auth: { admin: { createUser: jest.Mock; generateLink: jest.Mock } };
  };

  beforeEach(async () => {
    supabaseAdmin = {
      auth: {
        admin: {
          createUser: jest.fn(),
          generateLink: jest.fn(),
        },
      },
    };

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
        {
          provide: ListingPresentationClaimService,
          useValue: { claim: jest.fn() },
        },
        {
          provide: SupabaseService,
          useValue: { getClient: () => supabaseAdmin },
        },
      ],
    })
      .overrideGuard(AnonRateLimitGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(AnonymousController);
    listing = module.get(ListingPresentationService);
    cache = module.get(RedisTourCacheService);
    claimService = module.get(ListingPresentationClaimService);
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

  describe('POST /sign-up-with-tour', () => {
    const signUpDto = {
      email: 'newuser@test.local',
      password: 'hunter2hunter2',
      tourSessionId: 'sess-1-12345',
    };

    beforeEach(() => {
      supabaseAdmin.auth.admin.createUser.mockResolvedValue({
        data: { user: { id: 'user-99' } },
        error: null,
      });
      supabaseAdmin.auth.admin.generateLink.mockResolvedValue({
        data: { properties: { action_link: 'https://magic.example/abc' } },
      });
    });

    it('creates user, claims session, and returns userId + reportId in dev', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      claimService.claim.mockResolvedValue({ reportId: 'rpt-row-1' });

      const result = await controller.signUpWithTour(signUpDto);

      expect(supabaseAdmin.auth.admin.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: signUpDto.email,
          password: signUpDto.password,
          email_confirm: true,
        }),
      );
      expect(claimService.claim).toHaveBeenCalledWith({
        sessionId: signUpDto.tourSessionId,
        userId: 'user-99',
      });
      expect(result.userId).toBe('user-99');
      expect(result.reportId).toBe('rpt-row-1');
      expect(result.needsEmailConfirmation).toBe(false);
      expect(result.magicLink).toBe('https://magic.example/abc');

      process.env.NODE_ENV = originalEnv;
    });

    it('returns needsEmailConfirmation=true and no magic link in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      claimService.claim.mockResolvedValue({ reportId: 'rpt-row-1' });

      const result = await controller.signUpWithTour(signUpDto);

      expect(supabaseAdmin.auth.admin.createUser).toHaveBeenCalledWith(
        expect.objectContaining({ email_confirm: false }),
      );
      expect(result.needsEmailConfirmation).toBe(true);
      expect(result.magicLink).toBeNull();
      expect(supabaseAdmin.auth.admin.generateLink).not.toHaveBeenCalled();

      process.env.NODE_ENV = originalEnv;
    });

    it('throws UnauthorizedException when createUser fails', async () => {
      supabaseAdmin.auth.admin.createUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'email already exists' },
      });

      await expect(controller.signUpWithTour(signUpDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('returns reportId=null when claim throws but does not fail signup', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      claimService.claim.mockRejectedValue(new Error('redis down'));

      const result = await controller.signUpWithTour(signUpDto);

      expect(result.userId).toBe('user-99');
      expect(result.reportId).toBeNull();

      process.env.NODE_ENV = originalEnv;
    });

    it('returns reportId=null when claim returns null (session expired)', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      claimService.claim.mockResolvedValue(null);

      const result = await controller.signUpWithTour(signUpDto);
      expect(result.reportId).toBeNull();

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('POST /claim', () => {
    const claimDto = { tourSessionId: 'sess-1-12345' };

    it('returns claimed=true + reportId on success', async () => {
      claimService.claim.mockResolvedValue({ reportId: 'rpt-row-1' });
      const result = await controller.claim(claimDto, { userId: 'user-99' });
      expect(claimService.claim).toHaveBeenCalledWith({
        sessionId: claimDto.tourSessionId,
        userId: 'user-99',
      });
      expect(result).toEqual({ claimed: true, reportId: 'rpt-row-1' });
    });

    it('returns claimed=false + reportId=null when session not found', async () => {
      claimService.claim.mockResolvedValue(null);
      const result = await controller.claim(claimDto, { userId: 'user-99' });
      expect(result).toEqual({ claimed: false, reportId: null });
    });

    it('throws UnauthorizedException when req.userId is missing', async () => {
      await expect(controller.claim(claimDto, {})).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
