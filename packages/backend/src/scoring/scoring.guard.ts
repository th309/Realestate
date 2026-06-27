/**
 * Scoring Access Control Guard
 *
 * Controls access to PropertyIQ scores based on user subscription tier.
 * All access decisions are driven by the entitlements database (tier_features table).
 * No hardcoded tier arrays — use the admin tiers page to change access.
 *
 * DB features checked:
 * - feature_scores: Can the user see scores at all?
 * - feature_score_breakdown: Can the user see component breakdowns?
 * - feature_score_weights: Can the user see component weights?
 * - feature_score_history: Can the user see score history?
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  SetMetadata,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AnyScoreType } from './scoring.types';
import { UserFeaturesService } from '../admin/features/user-features.service';
import { EntitlementsService } from '../entitlements/entitlements.service';

export type ScoreAccess = 'full' | 'teaser';
export type UserTier = 'free' | 'basic' | 'pro' | 'enterprise' | 'admin';

// Decorator key for score access metadata
export const SCORE_ACCESS_KEY = 'scoreAccess';

// Decorator to specify required score access
export const RequireScoreAccess = (...scoreTypes: AnyScoreType[]) =>
  SetMetadata(SCORE_ACCESS_KEY, scoreTypes);

/**
 * Get upgrade message for locked scores
 */
export function getUpgradeMessage(scoreType: AnyScoreType): string {
  switch (scoreType) {
    case 'homeready':
      return 'See what drives this HomeReady score — affordability, market timing, and livability factors.';
    case 'investoredge':
      return 'See what drives this InvestorEdge score — cash flow, appreciation, and risk analysis.';
    default:
      return 'Upgrade to see the full score breakdown.';
  }
}

/**
 * Service for managing score access control.
 * All access checks read from the entitlements DB via UserFeaturesService.
 */
@Injectable()
export class ScoreAccessService {
  private readonly logger = new Logger(ScoreAccessService.name);

  constructor(
    private readonly userFeatures: UserFeaturesService,
    private readonly entitlements: EntitlementsService,
  ) {}

  /**
   * Check if a user's tier can access score component breakdowns.
   * Reads `feature_score_breakdown` from the DB.
   */
  async canAccessBreakdown(userTier: UserTier): Promise<boolean> {
    const resolved = await this.userFeatures.getUserFeatures('', userTier);
    return resolved.features['feature_score_breakdown'] === true;
  }

  /**
   * Check if a user's tier can access score component weights.
   * Reads `feature_score_weights` from the DB.
   */
  async canAccessWeights(userTier: UserTier): Promise<boolean> {
    const resolved = await this.userFeatures.getUserFeatures('', userTier);
    return resolved.features['feature_score_weights'] === true;
  }

  /**
   * Check if a user's tier can access score history.
   * Reads `feature_score_history` from the DB.
   */
  async canAccessHistory(userTier: UserTier): Promise<boolean> {
    const resolved = await this.userFeatures.getUserFeatures('', userTier);
    return resolved.features['feature_score_history'] === true;
  }

  /**
   * Check if a user's tier can access scores at all.
   * Reads `feature_scores` from the DB.
   */
  async canAccessScores(userTier: UserTier): Promise<boolean> {
    const resolved = await this.userFeatures.getUserFeatures('', userTier);
    return resolved.features['feature_scores'] === true;
  }

  /**
   * Get access level for scores: 'full' if breakdown is available, 'teaser' otherwise.
   */
  async getAccess(userTier: UserTier): Promise<ScoreAccess> {
    const canBreakdown = await this.canAccessBreakdown(userTier);
    return canBreakdown ? 'full' : 'teaser';
  }

  /**
   * Resolve the caller's tier for score-access decisions.
   *
   * SECURITY: tier is derived ONLY from a server-validated identity — never from
   * client-supplied input. The scoring endpoints are publicly reachable, so an
   * `x-user-tier` header or `?userTier` query would be attacker-controllable and
   * is deliberately NOT read here. (That bug let anyone unlock tier-gated score
   * breakdowns by setting a header; the same-origin proxy strips it, but a direct
   * backend request bypassed that.)
   *
   * Resolution order:
   *   1. `request.user.tier` — a tier already validated + attached by a guard.
   *   2. `request.userId` — set by `OptionalJwtAuthGuard` from a cryptographically
   *      validated Supabase JWT → authoritative tier via `EntitlementsService`.
   *   3. Otherwise fail closed to `free` (anonymous / no valid token).
   */
  async resolveUserTier(request: any): Promise<UserTier> {
    const serverValidatedTier = request?.user?.tier;
    if (serverValidatedTier) {
      return this.validateTier(serverValidatedTier);
    }

    const userId = request?.userId;
    if (userId) {
      const tier = await this.entitlements.getUserTier(userId);
      return this.validateTier(tier ?? 'free');
    }

    // Fail closed: no validated identity → free. Client-supplied `x-user-tier`
    // / `?userTier` are NOT trusted (see method docs).
    return 'free';
  }

  /**
   * Validate and normalize tier value
   */
  private validateTier(tier: string): UserTier {
    const validTiers: UserTier[] = [
      'free',
      'basic',
      'pro',
      'enterprise',
      'admin',
    ];
    const normalizedTier = tier.toLowerCase() as UserTier;
    return validTiers.includes(normalizedTier) ? normalizedTier : 'free';
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
    // Always allow — access level is handled in response (strip breakdown if needed)
    return true;
  }
}
