/**
 * Scoring Guard / Access Control Unit Tests
 *
 * Tests tier-based access control for PropertyIQ scores:
 * - Market Health Index: Available to ALL tiers (free, basic, pro, enterprise)
 * - HomeReady Score: Available to PRO and ENTERPRISE tiers only
 * - InvestorEdge Score: Available to PRO and ENTERPRISE tiers only
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  ScoreAccessService,
  ScoreAccessGuard,
  getScoreAccess,
  canAccessFullScore,
  getScoreAccessLevels,
  getRequiredTier,
  shouldShowUpgradeCta,
  getUpgradeMessage,
} from '../../scoring.guard';
import type { ScoreType, UserTier, ScoreAccess } from '../../scoring.types';

describe('Score Access Control', () => {
  // ============================================================================
  // Helper Functions Tests
  // ============================================================================

  describe('getScoreAccess', () => {
    describe('Market Health', () => {
      it('returns full access for free tier', () => {
        expect(getScoreAccess('market_health', 'free')).toBe('full');
      });

      it('returns full access for basic tier', () => {
        expect(getScoreAccess('market_health', 'basic')).toBe('full');
      });

      it('returns full access for pro tier', () => {
        expect(getScoreAccess('market_health', 'pro')).toBe('full');
      });

      it('returns full access for enterprise tier', () => {
        expect(getScoreAccess('market_health', 'enterprise')).toBe('full');
      });
    });

    describe('HomeReady', () => {
      it('returns teaser access for free tier', () => {
        expect(getScoreAccess('homeready', 'free')).toBe('teaser');
      });

      it('returns teaser access for basic tier', () => {
        expect(getScoreAccess('homeready', 'basic')).toBe('teaser');
      });

      it('returns full access for pro tier', () => {
        expect(getScoreAccess('homeready', 'pro')).toBe('full');
      });

      it('returns full access for enterprise tier', () => {
        expect(getScoreAccess('homeready', 'enterprise')).toBe('full');
      });
    });

    describe('InvestorEdge', () => {
      it('returns teaser access for free tier', () => {
        expect(getScoreAccess('investoredge', 'free')).toBe('teaser');
      });

      it('returns teaser access for basic tier', () => {
        expect(getScoreAccess('investoredge', 'basic')).toBe('teaser');
      });

      it('returns full access for pro tier', () => {
        expect(getScoreAccess('investoredge', 'pro')).toBe('full');
      });

      it('returns full access for enterprise tier', () => {
        expect(getScoreAccess('investoredge', 'enterprise')).toBe('full');
      });
    });
  });

  describe('canAccessFullScore', () => {
    it('returns true when user has full access', () => {
      expect(canAccessFullScore('market_health', 'free')).toBe(true);
      expect(canAccessFullScore('homeready', 'pro')).toBe(true);
      expect(canAccessFullScore('investoredge', 'enterprise')).toBe(true);
    });

    it('returns false when user has teaser access', () => {
      expect(canAccessFullScore('homeready', 'free')).toBe(false);
      expect(canAccessFullScore('homeready', 'basic')).toBe(false);
      expect(canAccessFullScore('investoredge', 'free')).toBe(false);
      expect(canAccessFullScore('investoredge', 'basic')).toBe(false);
    });
  });

  describe('getScoreAccessLevels', () => {
    it('returns correct access levels for free tier', () => {
      const levels = getScoreAccessLevels('free');

      expect(levels).toEqual({
        market_health: 'full',
        homeready: 'teaser',
        investoredge: 'teaser',
      });
    });

    it('returns correct access levels for basic tier', () => {
      const levels = getScoreAccessLevels('basic');

      expect(levels).toEqual({
        market_health: 'full',
        homeready: 'teaser',
        investoredge: 'teaser',
      });
    });

    it('returns correct access levels for pro tier', () => {
      const levels = getScoreAccessLevels('pro');

      expect(levels).toEqual({
        market_health: 'full',
        homeready: 'full',
        investoredge: 'full',
      });
    });

    it('returns correct access levels for enterprise tier', () => {
      const levels = getScoreAccessLevels('enterprise');

      expect(levels).toEqual({
        market_health: 'full',
        homeready: 'full',
        investoredge: 'full',
      });
    });
  });

  describe('getRequiredTier', () => {
    it('returns free for market_health', () => {
      expect(getRequiredTier('market_health')).toBe('free');
    });

    it('returns pro for homeready', () => {
      expect(getRequiredTier('homeready')).toBe('pro');
    });

    it('returns pro for investoredge', () => {
      expect(getRequiredTier('investoredge')).toBe('pro');
    });
  });

  describe('shouldShowUpgradeCta', () => {
    it('returns false for market_health with any tier', () => {
      expect(shouldShowUpgradeCta('market_health', 'free')).toBe(false);
      expect(shouldShowUpgradeCta('market_health', 'basic')).toBe(false);
      expect(shouldShowUpgradeCta('market_health', 'pro')).toBe(false);
    });

    it('returns true for homeready with free/basic tier', () => {
      expect(shouldShowUpgradeCta('homeready', 'free')).toBe(true);
      expect(shouldShowUpgradeCta('homeready', 'basic')).toBe(true);
    });

    it('returns false for homeready with pro/enterprise tier', () => {
      expect(shouldShowUpgradeCta('homeready', 'pro')).toBe(false);
      expect(shouldShowUpgradeCta('homeready', 'enterprise')).toBe(false);
    });

    it('returns true for investoredge with free/basic tier', () => {
      expect(shouldShowUpgradeCta('investoredge', 'free')).toBe(true);
      expect(shouldShowUpgradeCta('investoredge', 'basic')).toBe(true);
    });

    it('returns false for investoredge with pro/enterprise tier', () => {
      expect(shouldShowUpgradeCta('investoredge', 'pro')).toBe(false);
      expect(shouldShowUpgradeCta('investoredge', 'enterprise')).toBe(false);
    });
  });

  describe('getUpgradeMessage', () => {
    it('returns appropriate message for homeready', () => {
      const message = getUpgradeMessage('homeready');
      expect(message).toContain('HomeReady');
      expect(message).toContain('Pro');
    });

    it('returns appropriate message for investoredge', () => {
      const message = getUpgradeMessage('investoredge');
      expect(message).toContain('InvestorEdge');
      expect(message).toContain('Pro');
    });

    it('returns generic message for other score types', () => {
      const message = getUpgradeMessage('market_health');
      expect(message).toContain('Pro');
    });
  });

  // ============================================================================
  // ScoreAccessService Tests
  // ============================================================================

  describe('ScoreAccessService', () => {
    let service: ScoreAccessService;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [ScoreAccessService],
      }).compile();

      service = module.get<ScoreAccessService>(ScoreAccessService);
    });

    describe('getAccess', () => {
      it('returns correct access for each score type and tier', () => {
        expect(service.getAccess('market_health', 'free')).toBe('full');
        expect(service.getAccess('homeready', 'free')).toBe('teaser');
        expect(service.getAccess('investoredge', 'pro')).toBe('full');
      });
    });

    describe('hasFullAccess', () => {
      it('returns true for allowed tier/score combinations', () => {
        expect(service.hasFullAccess('market_health', 'free')).toBe(true);
        expect(service.hasFullAccess('homeready', 'pro')).toBe(true);
      });

      it('returns false for disallowed tier/score combinations', () => {
        expect(service.hasFullAccess('homeready', 'free')).toBe(false);
        expect(service.hasFullAccess('investoredge', 'basic')).toBe(false);
      });
    });

    describe('getAllAccessLevels', () => {
      it('returns access levels for all score types', () => {
        const levels = service.getAllAccessLevels('free');
        expect(levels).toHaveProperty('market_health');
        expect(levels).toHaveProperty('homeready');
        expect(levels).toHaveProperty('investoredge');
      });
    });

    describe('getUserTierFromRequest', () => {
      it('returns tier from user object', () => {
        const request = {
          user: { tier: 'pro' },
          headers: {},
        };
        expect(service.getUserTierFromRequest(request)).toBe('pro');
      });

      it('returns tier from x-user-tier header', () => {
        const request = {
          headers: { 'x-user-tier': 'enterprise' },
        };
        expect(service.getUserTierFromRequest(request)).toBe('enterprise');
      });

      it('returns tier from query parameter', () => {
        const request = {
          headers: {},
          query: { userTier: 'basic' },
        };
        expect(service.getUserTierFromRequest(request)).toBe('basic');
      });

      it('defaults to free tier when no tier specified', () => {
        const request = {
          headers: {},
        };
        expect(service.getUserTierFromRequest(request)).toBe('free');
      });

      it('validates and normalizes tier value', () => {
        const request = {
          user: { tier: 'PRO' }, // Uppercase
          headers: {},
        };
        expect(service.getUserTierFromRequest(request)).toBe('pro');
      });

      it('returns free for invalid tier value', () => {
        const request = {
          user: { tier: 'invalid_tier' },
          headers: {},
        };
        expect(service.getUserTierFromRequest(request)).toBe('free');
      });

      it('prioritizes user object over headers', () => {
        const request = {
          user: { tier: 'pro' },
          headers: { 'x-user-tier': 'enterprise' },
        };
        expect(service.getUserTierFromRequest(request)).toBe('pro');
      });
    });

    describe('getLockedScores', () => {
      it('returns locked scores for free tier', () => {
        const locked = service.getLockedScores('free');
        expect(locked).toContain('homeready');
        expect(locked).toContain('investoredge');
        expect(locked).not.toContain('market_health');
      });

      it('returns locked scores for basic tier', () => {
        const locked = service.getLockedScores('basic');
        expect(locked).toContain('homeready');
        expect(locked).toContain('investoredge');
      });

      it('returns empty array for pro tier', () => {
        const locked = service.getLockedScores('pro');
        expect(locked).toHaveLength(0);
      });

      it('returns empty array for enterprise tier', () => {
        const locked = service.getLockedScores('enterprise');
        expect(locked).toHaveLength(0);
      });
    });

    describe('getUnlockedScores', () => {
      it('returns only market_health for free tier', () => {
        const unlocked = service.getUnlockedScores('free');
        expect(unlocked).toContain('market_health');
        expect(unlocked).not.toContain('homeready');
        expect(unlocked).not.toContain('investoredge');
      });

      it('returns all scores for pro tier', () => {
        const unlocked = service.getUnlockedScores('pro');
        expect(unlocked).toContain('market_health');
        expect(unlocked).toContain('homeready');
        expect(unlocked).toContain('investoredge');
      });
    });
  });

  // ============================================================================
  // ScoreAccessGuard Tests
  // ============================================================================

  describe('ScoreAccessGuard', () => {
    let guard: ScoreAccessGuard;
    let reflector: Reflector;
    let scoreAccessService: ScoreAccessService;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ScoreAccessGuard,
          ScoreAccessService,
          Reflector,
        ],
      }).compile();

      guard = module.get<ScoreAccessGuard>(ScoreAccessGuard);
      reflector = module.get<Reflector>(Reflector);
      scoreAccessService = module.get<ScoreAccessService>(ScoreAccessService);
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

    describe('canActivate', () => {
      it('allows access when no score types are required', () => {
        jest.spyOn(reflector, 'get').mockReturnValue(undefined);

        const context = createMockContext();
        expect(guard.canActivate(context)).toBe(true);
      });

      it('allows access when required score types is empty array', () => {
        jest.spyOn(reflector, 'get').mockReturnValue([]);

        const context = createMockContext();
        expect(guard.canActivate(context)).toBe(true);
      });

      it('always allows access (access level handled in response)', () => {
        // The guard currently always returns true
        // Access levels are handled by the controller
        jest.spyOn(reflector, 'get').mockReturnValue(['homeready'] as ScoreType[]);

        const contextFree = createMockContext('free');
        const contextPro = createMockContext('pro');

        // Both should be allowed through the guard
        expect(guard.canActivate(contextFree)).toBe(true);
        expect(guard.canActivate(contextPro)).toBe(true);
      });
    });
  });

  // ============================================================================
  // Access Matrix Tests (Comprehensive)
  // ============================================================================

  describe('Access Matrix', () => {
    const scoreTypes: ScoreType[] = ['market_health', 'homeready', 'investoredge'];
    const userTiers: UserTier[] = ['free', 'basic', 'pro', 'enterprise'];

    /**
     * Expected access matrix:
     *
     *              | free   | basic  | pro    | enterprise |
     * market_health| full   | full   | full   | full       |
     * homeready    | teaser | teaser | full   | full       |
     * investoredge | teaser | teaser | full   | full       |
     */
    const expectedMatrix: Record<ScoreType, Record<UserTier, ScoreAccess>> = {
      market_health: {
        free: 'full',
        basic: 'full',
        pro: 'full',
        enterprise: 'full',
      },
      homeready: {
        free: 'teaser',
        basic: 'teaser',
        pro: 'full',
        enterprise: 'full',
      },
      investoredge: {
        free: 'teaser',
        basic: 'teaser',
        pro: 'full',
        enterprise: 'full',
      },
    };

    for (const scoreType of scoreTypes) {
      describe(`${scoreType}`, () => {
        for (const tier of userTiers) {
          it(`${tier} tier gets ${expectedMatrix[scoreType][tier]} access`, () => {
            const access = getScoreAccess(scoreType, tier);
            expect(access).toBe(expectedMatrix[scoreType][tier]);
          });
        }
      });
    }
  });

  // ============================================================================
  // Tier Hierarchy Tests
  // ============================================================================

  describe('Tier Hierarchy', () => {
    it('enterprise has all access that pro has', () => {
      const proLevels = getScoreAccessLevels('pro');
      const enterpriseLevels = getScoreAccessLevels('enterprise');

      for (const [scoreType, proAccess] of Object.entries(proLevels)) {
        const enterpriseAccess = enterpriseLevels[scoreType as ScoreType];
        // If pro has full, enterprise must have full
        if (proAccess === 'full') {
          expect(enterpriseAccess).toBe('full');
        }
      }
    });

    it('pro has all access that basic has', () => {
      const basicLevels = getScoreAccessLevels('basic');
      const proLevels = getScoreAccessLevels('pro');

      for (const [scoreType, basicAccess] of Object.entries(basicLevels)) {
        const proAccess = proLevels[scoreType as ScoreType];
        // If basic has full, pro must have full
        if (basicAccess === 'full') {
          expect(proAccess).toBe('full');
        }
      }
    });

    it('basic has all access that free has', () => {
      const freeLevels = getScoreAccessLevels('free');
      const basicLevels = getScoreAccessLevels('basic');

      for (const [scoreType, freeAccess] of Object.entries(freeLevels)) {
        const basicAccess = basicLevels[scoreType as ScoreType];
        // If free has full, basic must have full
        if (freeAccess === 'full') {
          expect(basicAccess).toBe('full');
        }
      }
    });
  });

  // ============================================================================
  // Business Rule Tests
  // ============================================================================

  describe('Business Rules', () => {
    it('free tier can always access Market Health (lead gen)', () => {
      expect(canAccessFullScore('market_health', 'free')).toBe(true);
    });

    it('premium scores require Pro tier or higher', () => {
      const premiumScores: ScoreType[] = ['homeready', 'investoredge'];

      for (const score of premiumScores) {
        // Free and basic should NOT have full access
        expect(canAccessFullScore(score, 'free')).toBe(false);
        expect(canAccessFullScore(score, 'basic')).toBe(false);

        // Pro and enterprise SHOULD have full access
        expect(canAccessFullScore(score, 'pro')).toBe(true);
        expect(canAccessFullScore(score, 'enterprise')).toBe(true);
      }
    });

    it('upgrade CTA only shows for premium scores to lower tiers', () => {
      // Free users see CTA for premium scores
      expect(shouldShowUpgradeCta('homeready', 'free')).toBe(true);
      expect(shouldShowUpgradeCta('investoredge', 'free')).toBe(true);

      // But not for market health
      expect(shouldShowUpgradeCta('market_health', 'free')).toBe(false);

      // Pro users see no CTAs
      expect(shouldShowUpgradeCta('homeready', 'pro')).toBe(false);
      expect(shouldShowUpgradeCta('investoredge', 'pro')).toBe(false);
      expect(shouldShowUpgradeCta('market_health', 'pro')).toBe(false);
    });
  });

  // ============================================================================
  // Edge Case Tests
  // ============================================================================

  describe('Edge Cases', () => {
    let service: ScoreAccessService;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [ScoreAccessService],
      }).compile();

      service = module.get<ScoreAccessService>(ScoreAccessService);
    });

    it('handles null user in request', () => {
      const request = {
        user: null,
        headers: {},
      };
      expect(service.getUserTierFromRequest(request)).toBe('free');
    });

    it('handles undefined user in request', () => {
      const request = {
        headers: {},
      };
      expect(service.getUserTierFromRequest(request)).toBe('free');
    });

    it('handles empty headers object', () => {
      const request = {
        headers: {},
      };
      expect(service.getUserTierFromRequest(request)).toBe('free');
    });

    it('handles missing headers object', () => {
      const request = {};
      expect(service.getUserTierFromRequest(request)).toBe('free');
    });

    it('handles case-insensitive tier values', () => {
      const upperCase = { user: { tier: 'PRO' }, headers: {} };
      const lowerCase = { user: { tier: 'pro' }, headers: {} };
      const mixedCase = { user: { tier: 'Pro' }, headers: {} };

      expect(service.getUserTierFromRequest(upperCase)).toBe('pro');
      expect(service.getUserTierFromRequest(lowerCase)).toBe('pro');
      expect(service.getUserTierFromRequest(mixedCase)).toBe('pro');
    });

    it('returns free for tier with extra whitespace', () => {
      // Whitespace should make it invalid -> free
      const request = { user: { tier: ' pro ' }, headers: {} };
      expect(service.getUserTierFromRequest(request)).toBe('free');
    });
  });

  // ============================================================================
  // Type Safety Tests
  // ============================================================================

  describe('Type Safety', () => {
    it('all score types in access matrix are valid ScoreType', () => {
      const scoreTypes: ScoreType[] = ['market_health', 'homeready', 'investoredge'];

      for (const scoreType of scoreTypes) {
        // Should not throw
        expect(() => getScoreAccess(scoreType, 'free')).not.toThrow();
        expect(() => getRequiredTier(scoreType)).not.toThrow();
      }
    });

    it('all user tiers are valid UserTier', () => {
      const userTiers: UserTier[] = ['free', 'basic', 'pro', 'enterprise'];

      for (const tier of userTiers) {
        // Should not throw
        expect(() => getScoreAccessLevels(tier)).not.toThrow();
      }
    });

    it('access levels are valid ScoreAccess', () => {
      const validAccess: ScoreAccess[] = ['full', 'teaser'];
      const levels = getScoreAccessLevels('free');

      for (const access of Object.values(levels)) {
        expect(validAccess).toContain(access);
      }
    });
  });
});
