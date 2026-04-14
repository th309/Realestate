import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { UserFeaturesService } from '../admin/features/user-features.service';
import { RedisService } from '../redis/redis.service';
import { TrialFeatureUsageEmitterService } from './trial-feature-usage-emitter.service';

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
  ) {}

  async checkAccess(
    userId: string | null,
    tierOverride: string | null,
    resources: string[],
  ): Promise<EntitlementsResponse> {
    // Determine effective tier
    let tier = tierOverride || 'free';
    let trial: EntitlementsResponse['trial'] = null;
    let needsPerUserQuery = false;
    // Baseline tier = what tier the user would be on WITHOUT their active trial.
    // Used to decide whether to emit trial.pro_feature_used (we only emit when
    // the trial genuinely granted access the user wouldn't otherwise have).
    let baselineTierWithoutTrial: string | null = null;

    if (userId && !tierOverride) {
      // Check for active trial (per-user, cannot be cached by tier)
      const trialInfo = await this.getActiveTrial(userId);
      if (trialInfo) {
        tier = trialInfo.tier;
        trial = {
          active: true,
          daysRemaining: trialInfo.daysRemaining,
          tier: trialInfo.tier,
        };
        needsPerUserQuery = true;

        // Check subscription tier to determine if trial is actually granting
        // access. If user is already Pro/Enterprise, the trial is redundant.
        const { data: profile } = await this.supabase
          .getClient()
          .from('user_profiles')
          .select('subscription_tier, subscription_status')
          .eq('id', userId)
          .single();

        const paidTier =
          profile?.subscription_tier &&
          profile.subscription_tier !== 'free' &&
          (profile.subscription_tier === 'admin' ||
            profile.subscription_status === 'active' ||
            !profile.subscription_status)
            ? profile.subscription_tier
            : 'free';
        baselineTierWithoutTrial = paidTier;
      } else {
        // Check subscription tier from Stripe sync
        const { data: profile } = await this.supabase
          .getClient()
          .from('user_profiles')
          .select('subscription_tier, subscription_status')
          .eq('id', userId)
          .single();

        if (
          profile?.subscription_tier &&
          profile.subscription_tier !== 'free'
        ) {
          // Admin is a manually-set role, not a Stripe subscription —
          // skip subscription_status check so it always resolves.
          const isAdmin = profile.subscription_tier === 'admin';
          if (
            isAdmin ||
            profile.subscription_status === 'active' ||
            !profile.subscription_status
          ) {
            tier = profile.subscription_tier;
          }
        }

        // If tier is still 'free', check admin_users table —
        // admin/super_admin users get full access regardless of subscription tier.
        if (tier === 'free') {
          const { data: adminRow } = await this.supabase
            .getClient()
            .from('admin_users')
            .select('role')
            .eq('id', userId)
            .single();

          if (
            adminRow &&
            (adminRow.role === 'admin' || adminRow.role === 'super_admin')
          ) {
            tier = 'admin';
            this.logger.debug(
              `[Entitlements] User ${userId.substring(0, 8)}... is ${adminRow.role} — granting admin tier`,
            );
          }
        }
      }
    }

    // Try tier-based cache for non-trial users (most users on the same tier get identical access)
    const resourceKey = resources.slice().sort().join(',');
    const cacheKey = `entitlements:tier:${tier}:${resourceKey}`;

    if (!needsPerUserQuery) {
      const cached = await this.redis.getByKey(cacheKey);
      if (cached) {
        this.logger.debug(`[Entitlements] Cache HIT for tier=${tier}`);
        // Return cached access with trial=null (no trial for cached responses)
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
        // Find which tier has this feature
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

  private async getActiveTrial(userId: string): Promise<{
    tier: string;
    daysRemaining: number;
  } | null> {
    const client = this.supabase.getClient();

    const { data } = await client
      .from('user_trials')
      .select('tier, expires_at')
      .eq('user_id', userId)
      .is('converted_at', null)
      .is('cancelled_at', null)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (!data) return null;

    const daysRemaining = Math.ceil(
      (new Date(data.expires_at).getTime() - Date.now()) /
        (1000 * 60 * 60 * 24),
    );

    return { tier: data.tier, daysRemaining };
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
