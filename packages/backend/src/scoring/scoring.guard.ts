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
import type { ScoreType } from './scoring.types';
import { UserFeaturesService } from '../admin/features/user-features.service';

export type ScoreAccess = 'full' | 'teaser';
export type UserTier = 'free' | 'basic' | 'pro' | 'enterprise';

// Decorator key for score access metadata
export const SCORE_ACCESS_KEY = 'scoreAccess';

// Decorator to specify required score access
export const RequireScoreAccess = (...scoreTypes: ScoreType[]) =>
  SetMetadata(SCORE_ACCESS_KEY, scoreTypes);

/**
 * Get upgrade message for locked scores
 */
export function getUpgradeMessage(scoreType: ScoreType): string {
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

  constructor(private readonly userFeatures: UserFeaturesService) {}

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
   * Determine user tier from request headers or user object
   */
  getUserTierFromRequest(request: any): UserTier {
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
