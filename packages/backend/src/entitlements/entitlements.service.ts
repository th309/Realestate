import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { UserFeaturesService } from '../admin/features/user-features.service';
import { RedisService } from '../redis/redis.service';
import { TrialFeatureUsageEmitterService } from './trial-feature-usage-emitter.service';
import { TierResolverService } from './tier-resolver.service';

export interface AccessCheck {
  level: 'full' | 'preview' | 'none';
  limit?: number;
  tierRequired?: string;
}

export interface EntitlementsResponse {
  tier: string;
  access: Record<string, AccessCheck>;
  trial: {
    active: boolean;
    daysRemaining?: number;
    tier?: string;
  } | null;
}

@Injectable()
export class EntitlementsService {
  private readonly logger = new Logger(EntitlementsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly userFeatures: UserFeaturesService,
    private readonly redis: RedisService,
    private readonly trialUsageEmitter: TrialFeatureUsageEmitterService,
    private readonly tierResolver: TierResolverService,
  ) {}

  async checkAccess(
    userId: string | null,
    tierOverride: string | null,
    resources: string[],
  ): Promise<EntitlementsResponse> {
    const { tier, trial, baselineTierWithoutTrial, needsPerUserQuery } =
      await this.tierResolver.resolve(userId, tierOverride);

    // Try tier-based cache for non-trial users (most users on the same tier get identical access)
    const resourceKey = resources.slice().sort().join(',');
    const cacheKey = `entitlements:tier:${tier}:${resourceKey}`;

    if (!needsPerUserQuery) {
      const cached = await this.redis.getByKey(cacheKey);
      if (cached) {
        this.logger.debug(`[Entitlements] Cache HIT for tier=${tier}`);
        return { ...cached, trial };
      }
    }

    // Get user features (tier-based for cache, user-specific for trial users)
    const resolved = await this.userFeatures.getUserFeatures(
      userId || '',
      tier,
    );

    // Build access map
    const access: Record<string, AccessCheck> = {};

    for (const resource of resources) {
      const [type, id] = resource.split(':');
      // DB slugs are inconsistent: some have type prefix (metric_home_value, geo_state,
      // feature_reports) and some don't (watchlist_limit, alerts_limit). Try prefixed first.
      const prefixedSlug = `${type}_${id}`;
      const hasAccess =
        resolved.features[prefixedSlug] ?? resolved.features[id];
      const effectiveSlug =
        resolved.features[prefixedSlug] !== undefined ? prefixedSlug : id;

      if (hasAccess === true || hasAccess === -1) {
        access[resource] = { level: 'full' };
      } else if (typeof hasAccess === 'number' && hasAccess > 0) {
        access[resource] = { level: 'preview', limit: hasAccess };
      } else {
        const tierRequired = await this.findTierWithFeature(effectiveSlug);
        access[resource] = { level: 'none', tierRequired };
      }
    }

    const response: EntitlementsResponse = { tier, access, trial };

    // Cache tier-based response (skip for trial users since their access is temporary)
    if (!needsPerUserQuery) {
      const ttl = this.redis.getTTL('entitlements'); // 30 minutes
      await this.redis.setByKey(cacheKey, { tier, access }, ttl);
      this.logger.debug(`[Entitlements] Cached tier=${tier} (TTL: ${ttl}s)`);
    }

    // Emit trial.pro_feature_used when a trial user is granted access to a
    // Pro-gated feature specifically because of their trial. Fire per
    // granted resource so downstream analytics can aggregate per-feature
    // engagement. Fire-and-forget: analytics must never break entitlement
    // checks. Skipped when baseline tier is already paid (trial is
    // redundant) or when access would have been granted on free tier.
    if (
      userId &&
      trial?.active &&
      baselineTierWithoutTrial === 'free' &&
      Object.keys(access).length > 0
    ) {
      this.trialUsageEmitter
        .emitForGrantedAccess(userId, access)
        .catch(() => {});
    }

    return response;
  }

  /**
   * Resolve the effective tier for a user using the canonical
   * `TierResolverService`. Single source of truth for tier checks across the
   * backend hot path — direct `user_profiles.subscription_tier` reads in
   * controllers should be replaced with this method so trial / org-tier /
   * admin-fallback resolution stays consistent.
   *
   * Returns the resolved tier string (`'free' | 'pro' | 'enterprise' | 'admin'`)
   * or `null` when no user is supplied. Returning `null` lets callers warn on
   * "expected a profile, got nothing" cases without conflating with explicit
   * free users.
   */
  async getUserTier(userId: string | null): Promise<string | null> {
    if (!userId) return null;
    const { tier } = await this.tierResolver.resolve(userId, null);
    return tier ?? null;
  }

  async trackPaywallEvent(data: {
    userId?: string;
    sessionId?: string;
    resourceType: string;
    resourceId: string;
    userTier: string;
    pagePath?: string;
    eventType: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const client = this.supabase.getClient();

    await client.from('paywall_events').insert({
      user_id: data.userId,
      session_id: data.sessionId,
      resource_type: data.resourceType,
      resource_id: data.resourceId,
      user_tier: data.userTier,
      page_path: data.pagePath,
      event_type: data.eventType,
      metadata: data.metadata || {},
    });
  }

  private async findTierWithFeature(featureSlug: string): Promise<string> {
    const client = this.supabase.getClient();

    const { data: featureData } = await client
      .from('feature_definitions')
      .select('id')
      .eq('slug', featureSlug)
      .single();

    if (!featureData?.id) {
      return 'pro';
    }

    const { data } = await client
      .from('tier_features')
      .select('tier:subscription_tiers(slug)')
      .eq('feature_id', featureData.id)
      .eq('value', true)
      .order('tier(display_order)')
      .limit(1)
      .single();

    return (data?.tier as any)?.slug || 'pro';
  }
}
