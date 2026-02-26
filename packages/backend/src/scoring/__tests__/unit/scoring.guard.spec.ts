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

    beforeEach(async () => {
      userFeaturesMock = {
        getUserFeatures: jest.fn(),
        hasFeature: jest.fn(),
        getFeatureLimit: jest.fn(),
        createOverride: jest.fn(),
        removeOverride: jest.fn(),
        getUserOverrides: jest.fn(),
      } as unknown as jest.Mocked<UserFeaturesService>;

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ScoreAccessService,
          { provide: UserFeaturesService, useValue: userFeaturesMock },
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

    describe('getUserTierFromRequest', () => {
      it('returns tier from user object', () => {
        const request = { user: { tier: 'pro' }, headers: {} };
        expect(service.getUserTierFromRequest(request)).toBe('pro');
      });

      it('returns tier from x-user-tier header', () => {
        const request = { headers: { 'x-user-tier': 'enterprise' } };
        expect(service.getUserTierFromRequest(request)).toBe('enterprise');
      });

      it('returns tier from query parameter', () => {
        const request = { headers: {}, query: { userTier: 'basic' } };
        expect(service.getUserTierFromRequest(request)).toBe('basic');
      });

      it('defaults to free when no tier specified', () => {
        const request = { headers: {} };
        expect(service.getUserTierFromRequest(request)).toBe('free');
      });

      it('normalizes uppercase tier values', () => {
        const request = { user: { tier: 'PRO' }, headers: {} };
        expect(service.getUserTierFromRequest(request)).toBe('pro');
      });

      it('returns free for invalid tier value', () => {
        const request = { user: { tier: 'invalid_tier' }, headers: {} };
        expect(service.getUserTierFromRequest(request)).toBe('free');
      });

      it('prioritizes user object over headers', () => {
        const request = {
          user: { tier: 'pro' },
          headers: { 'x-user-tier': 'enterprise' },
        };
        expect(service.getUserTierFromRequest(request)).toBe('pro');
      });

      it('handles null user in request', () => {
        const request = { user: null, headers: {} };
        expect(service.getUserTierFromRequest(request)).toBe('free');
      });

      it('handles missing headers object', () => {
        const request = {};
        expect(service.getUserTierFromRequest(request)).toBe('free');
      });

      it('returns free for tier with extra whitespace', () => {
        const request = { user: { tier: ' pro ' }, headers: {} };
        expect(service.getUserTierFromRequest(request)).toBe('free');
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
