/**
 * Scoring Guard / Access Control Unit Tests
 *
 * Tests the DB-driven score access control system.
 * ScoreAccessService reads entitlements from UserFeaturesService,
 * so all tests mock the DB layer and verify correct access resolution.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  ScoreAccessService,
  ScoreAccessGuard,
  getUpgradeMessage,
} from '../../scoring.guard';
import {
  UserFeaturesService,
  ResolvedFeatures,
} from '../../../admin/features/user-features.service';
import { EntitlementsService } from '../../../entitlements/entitlements.service';

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

function mockFeatures(
  overrides: Record<string, unknown> = {},
): ResolvedFeatures {
  return {
    tier: 'free',
    features: {
      feature_scores: true,
      feature_score_breakdown: false,
      feature_score_weights: false,
      feature_score_history: false,
      ...overrides,
    },
    limits: {},
    detailed: [],
  };
}

const FREE_FEATURES = mockFeatures({
  feature_scores: true,
  feature_score_breakdown: false,
  feature_score_weights: false,
  feature_score_history: false,
});

const PRO_FEATURES = mockFeatures({
  feature_scores: true,
  feature_score_breakdown: true,
  feature_score_weights: true,
  feature_score_history: true,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Score Access Control', () => {
  describe('getUpgradeMessage', () => {
    it('returns HomeReady-specific message', () => {
      const message = getUpgradeMessage('homeready');
      expect(message).toContain('HomeReady');
    });

    it('returns InvestorEdge-specific message', () => {
      const message = getUpgradeMessage('investoredge');
      expect(message).toContain('InvestorEdge');
    });

    it('returns generic upgrade message for other score types', () => {
      const message = getUpgradeMessage('markethealth');
      expect(message).toContain('Upgrade');
    });
  });

  describe('ScoreAccessService', () => {
    let service: ScoreAccessService;
    let userFeaturesMock: jest.Mocked<UserFeaturesService>;
    let entitlementsMock: jest.Mocked<EntitlementsService>;

    beforeEach(async () => {
      userFeaturesMock = {
        getUserFeatures: jest.fn(),
        hasFeature: jest.fn(),
        getFeatureLimit: jest.fn(),
        createOverride: jest.fn(),
        removeOverride: jest.fn(),
        getUserOverrides: jest.fn(),
      } as unknown as jest.Mocked<UserFeaturesService>;

      entitlementsMock = {
        getUserTier: jest.fn(),
      } as unknown as jest.Mocked<EntitlementsService>;

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ScoreAccessService,
          { provide: UserFeaturesService, useValue: userFeaturesMock },
          { provide: EntitlementsService, useValue: entitlementsMock },
        ],
      }).compile();

      service = module.get<ScoreAccessService>(ScoreAccessService);
    });

    describe('canAccessBreakdown', () => {
      it('returns true when feature_score_breakdown is enabled', async () => {
        userFeaturesMock.getUserFeatures.mockResolvedValue(PRO_FEATURES);
        expect(await service.canAccessBreakdown('pro')).toBe(true);
      });

      it('returns false when feature_score_breakdown is disabled', async () => {
        userFeaturesMock.getUserFeatures.mockResolvedValue(FREE_FEATURES);
        expect(await service.canAccessBreakdown('free')).toBe(false);
      });
    });

    describe('canAccessWeights', () => {
      it('returns true when feature_score_weights is enabled', async () => {
        userFeaturesMock.getUserFeatures.mockResolvedValue(PRO_FEATURES);
        expect(await service.canAccessWeights('pro')).toBe(true);
      });

      it('returns false when feature_score_weights is disabled', async () => {
        userFeaturesMock.getUserFeatures.mockResolvedValue(FREE_FEATURES);
        expect(await service.canAccessWeights('free')).toBe(false);
      });
    });

    describe('canAccessHistory', () => {
      it('returns true when feature_score_history is enabled', async () => {
        userFeaturesMock.getUserFeatures.mockResolvedValue(PRO_FEATURES);
        expect(await service.canAccessHistory('pro')).toBe(true);
      });

      it('returns false when feature_score_history is disabled', async () => {
        userFeaturesMock.getUserFeatures.mockResolvedValue(FREE_FEATURES);
        expect(await service.canAccessHistory('free')).toBe(false);
      });
    });

    describe('canAccessScores', () => {
      it('returns true when feature_scores is enabled', async () => {
        userFeaturesMock.getUserFeatures.mockResolvedValue(FREE_FEATURES);
        expect(await service.canAccessScores('free')).toBe(true);
      });

      it('returns false when feature_scores is disabled', async () => {
        userFeaturesMock.getUserFeatures.mockResolvedValue(
          mockFeatures({ feature_scores: false }),
        );
        expect(await service.canAccessScores('free')).toBe(false);
      });
    });

    describe('getAccess', () => {
      it('returns full when breakdown is available', async () => {
        userFeaturesMock.getUserFeatures.mockResolvedValue(PRO_FEATURES);
        expect(await service.getAccess('pro')).toBe('full');
      });

      it('returns teaser when breakdown is unavailable', async () => {
        userFeaturesMock.getUserFeatures.mockResolvedValue(FREE_FEATURES);
        expect(await service.getAccess('free')).toBe('teaser');
      });
    });

    describe('resolveUserTier', () => {
      it('returns tier from the server-set user object', async () => {
        const request = { user: { tier: 'pro' }, headers: {} };
        expect(await service.resolveUserTier(request)).toBe('pro');
      });

      it('normalizes uppercase tier values', async () => {
        const request = { user: { tier: 'PRO' }, headers: {} };
        expect(await service.resolveUserTier(request)).toBe('pro');
      });

      it('returns free for invalid tier value', async () => {
        const request = { user: { tier: 'invalid_tier' }, headers: {} };
        expect(await service.resolveUserTier(request)).toBe('free');
      });

      it('returns free for tier with extra whitespace', async () => {
        const request = { user: { tier: ' pro ' }, headers: {} };
        expect(await service.resolveUserTier(request)).toBe('free');
      });

      it('defaults to free when no tier specified', async () => {
        const request = { headers: {} };
        expect(await service.resolveUserTier(request)).toBe('free');
      });

      it('handles null user in request', async () => {
        const request = { user: null, headers: {} };
        expect(await service.resolveUserTier(request)).toBe('free');
      });

      it('handles missing headers object', async () => {
        const request = {};
        expect(await service.resolveUserTier(request)).toBe('free');
      });

      // --- Authoritative tier from a validated JWT identity ---
      it('resolves tier from request.userId via EntitlementsService', async () => {
        entitlementsMock.getUserTier.mockResolvedValue('pro');
        const request = { userId: 'user-123', headers: {} };
        expect(await service.resolveUserTier(request)).toBe('pro');
        expect(entitlementsMock.getUserTier).toHaveBeenCalledWith('user-123');
      });

      it('falls back to free when EntitlementsService resolves null', async () => {
        entitlementsMock.getUserTier.mockResolvedValue(null);
        const request = { userId: 'orphan-user', headers: {} };
        expect(await service.resolveUserTier(request)).toBe('free');
      });

      // --- SECURITY: client-supplied tier must NOT be trusted ---
      // The scoring endpoints are publicly reachable, so a spoofed header/query
      // must never unlock tier-gated score breakdowns. The same-origin proxy
      // strips `x-user-tier`, but a request sent directly to the backend bypasses
      // that — tier resolution must fail closed.
      it('IGNORES a spoofed x-user-tier header (no privilege escalation)', async () => {
        const request = { headers: { 'x-user-tier': 'enterprise' } };
        expect(await service.resolveUserTier(request)).toBe('free');
        expect(entitlementsMock.getUserTier).not.toHaveBeenCalled();
      });

      it('IGNORES a spoofed userTier query parameter', async () => {
        const request = { headers: {}, query: { userTier: 'enterprise' } };
        expect(await service.resolveUserTier(request)).toBe('free');
      });

      it('does not let a spoofed header override the validated identity', async () => {
        entitlementsMock.getUserTier.mockResolvedValue('free');
        const request = {
          userId: 'user-123',
          headers: { 'x-user-tier': 'enterprise' },
        };
        expect(await service.resolveUserTier(request)).toBe('free');
      });
    });
  });

  describe('ScoreAccessGuard', () => {
    let guard: ScoreAccessGuard;

    beforeEach(async () => {
      const userFeaturesMock = {
        getUserFeatures: jest.fn(),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ScoreAccessGuard,
          ScoreAccessService,
          Reflector,
          { provide: UserFeaturesService, useValue: userFeaturesMock },
          {
            provide: EntitlementsService,
            useValue: { getUserTier: jest.fn() },
          },
        ],
      }).compile();

      guard = module.get<ScoreAccessGuard>(ScoreAccessGuard);
    });

    function createMockContext(userTier?: string): ExecutionContext {
      return {
        switchToHttp: () => ({
          getRequest: () => ({
            user: userTier ? { tier: userTier } : undefined,
            headers: {},
          }),
        }),
        getHandler: () => jest.fn(),
        getClass: () => jest.fn(),
      } as unknown as ExecutionContext;
    }

    it('always allows access (level handled in response)', () => {
      const contextFree = createMockContext('free');
      const contextPro = createMockContext('pro');

      expect(guard.canActivate(contextFree)).toBe(true);
      expect(guard.canActivate(contextPro)).toBe(true);
    });

    it('allows access when no user is authenticated', () => {
      const context = createMockContext();
      expect(guard.canActivate(context)).toBe(true);
    });
  });
});
