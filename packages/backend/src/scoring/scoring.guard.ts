/**
 * Scoring Access Control Guard
 *
 * Controls access to PropertyIQ scores based on user subscription tier:
 * - Market Health Index: Available to ALL tiers (free, basic, pro, enterprise)
 * - HomeReady Score: Available to PRO and ENTERPRISE tiers only
 * - InvestorEdge Score: Available to PRO and ENTERPRISE tiers only
 *
 * Users without the required tier get a "teaser" response with limited data
 * and an upgrade call-to-action.
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  ScoreType,
  ScoreAccess,
  UserTier,
  SCORE_ACCESS_CONFIG,
} from './scoring.types';

// Decorator key for score access metadata
export const SCORE_ACCESS_KEY = 'scoreAccess';

// Decorator to specify required score access
export const RequireScoreAccess = (...scoreTypes: ScoreType[]) =>
  SetMetadata(SCORE_ACCESS_KEY, scoreTypes);

/**
 * Determine what level of access a user has for a specific score type
 */
export function getScoreAccess(scoreType: ScoreType, userTier: UserTier): ScoreAccess {
  const allowedTiers = SCORE_ACCESS_CONFIG[scoreType];
  return allowedTiers.includes(userTier) ? 'full' : 'teaser';
}

/**
 * Check if a user can access the full score details
 */
export function canAccessFullScore(
  scoreType: ScoreType,
  userTier: UserTier,
): boolean {
  return getScoreAccess(scoreType, userTier) === 'full';
}

/**
 * Get all scores with their access levels for a user
 */
export function getScoreAccessLevels(userTier: UserTier): Record<ScoreType, ScoreAccess> {
  return {
    market_health: getScoreAccess('market_health', userTier),
    homeready: getScoreAccess('homeready', userTier),
    investoredge: getScoreAccess('investoredge', userTier),
  };
}

/**
 * Get the minimum tier required for full access to a score
 */
export function getRequiredTier(scoreType: ScoreType): UserTier {
  switch (scoreType) {
    case 'market_health':
      return 'free'; // Available to everyone
    case 'homeready':
    case 'investoredge':
      return 'pro'; // Requires Pro or higher
    default:
      return 'pro';
  }
}

/**
 * Check if user should see upgrade CTA for a score
 */
export function shouldShowUpgradeCta(
  scoreType: ScoreType,
  userTier: UserTier,
): boolean {
  return getScoreAccess(scoreType, userTier) === 'teaser';
}

/**
 * Get upgrade message for locked scores
 */
export function getUpgradeMessage(scoreType: ScoreType): string {
  switch (scoreType) {
    case 'homeready':
      return 'Upgrade to Pro to unlock the HomeReady Score with affordability, market timing, and livability insights.';
    case 'investoredge':
      return 'Upgrade to Pro to unlock the InvestorEdge Score with cash flow, appreciation, and risk analysis.';
    default:
      return 'Upgrade to Pro to unlock premium scores and insights.';
  }
}

/**
 * Service for managing score access control
 */
@Injectable()
export class ScoreAccessService {
  /**
   * Get access level for a score type based on user tier
   */
  getAccess(scoreType: ScoreType, userTier: UserTier): ScoreAccess {
    return getScoreAccess(scoreType, userTier);
  }

  /**
   * Check if user has full access to a score
   */
  hasFullAccess(scoreType: ScoreType, userTier: UserTier): boolean {
    return canAccessFullScore(scoreType, userTier);
  }

  /**
   * Get access levels for all scores
   */
  getAllAccessLevels(userTier: UserTier): Record<ScoreType, ScoreAccess> {
    return getScoreAccessLevels(userTier);
  }

  /**
   * Determine user tier from request headers or user object
   */
  getUserTierFromRequest(request: any): UserTier {
    // Check for user tier in various locations
    // 1. From authenticated user object
    if (request.user?.tier) {
      return this.validateTier(request.user.tier);
    }

    // 2. From x-user-tier header (for testing/internal use)
    const headerTier = request.headers?.['x-user-tier'];
    if (headerTier) {
      return this.validateTier(headerTier);
    }

    // 3. From query parameter (for testing)
    if (request.query?.userTier) {
      return this.validateTier(request.query.userTier);
    }

    // Default to free tier
    return 'free';
  }

  /**
   * Validate and normalize tier value
   */
  private validateTier(tier: string): UserTier {
    const validTiers: UserTier[] = ['free', 'basic', 'pro', 'enterprise'];
    const normalizedTier = tier.toLowerCase() as UserTier;
    return validTiers.includes(normalizedTier) ? normalizedTier : 'free';
  }

  /**
   * Get scores that require upgrade for a user
   */
  getLockedScores(userTier: UserTier): ScoreType[] {
    const accessLevels = this.getAllAccessLevels(userTier);
    return (Object.entries(accessLevels) as [ScoreType, ScoreAccess][])
      .filter(([, access]) => access === 'teaser')
      .map(([type]) => type);
  }

  /**
   * Get scores that user has full access to
   */
  getUnlockedScores(userTier: UserTier): ScoreType[] {
    const accessLevels = this.getAllAccessLevels(userTier);
    return (Object.entries(accessLevels) as [ScoreType, ScoreAccess][])
      .filter(([, access]) => access === 'full')
      .map(([type]) => type);
  }
}

/**
 * Guard that checks if user has required score access
 * Use with @RequireScoreAccess decorator
 */
@Injectable()
export class ScoreAccessGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private scoreAccessService: ScoreAccessService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    // Get required score types from decorator
    const requiredScoreTypes = this.reflector.get<ScoreType[]>(
      SCORE_ACCESS_KEY,
      context.getHandler(),
    );

    // If no specific score types required, allow access
    if (!requiredScoreTypes || requiredScoreTypes.length === 0) {
      return true;
    }

    // Get user tier from request
    const request = context.switchToHttp().getRequest();
    const userTier = this.scoreAccessService.getUserTierFromRequest(request);

    // Check if user has full access to any required score type
    // Note: This guard allows access but the controller should still
    // return teaser data for users without full access
    return true; // Always allow - access level is handled in response
  }
}

/**
 * Decorator to inject score access level into request
 */
export function InjectScoreAccess() {
  return (target: any, key: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const request = args.find(
        (arg) => arg && typeof arg === 'object' && 'headers' in arg,
      );

      if (request && this.scoreAccessService) {
        const userTier = this.scoreAccessService.getUserTierFromRequest(request);
        request.scoreAccessLevels = getScoreAccessLevels(userTier);
        request.userTier = userTier;
      }

      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}
