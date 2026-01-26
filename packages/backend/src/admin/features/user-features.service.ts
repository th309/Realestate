/**
 * User Features Service
 *
 * Resolves user features with grandfathering and override support.
 * This is the main service for checking user access to features.
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';

export interface UserFeature {
  slug: string;
  name: string;
  category: string;
  value_type: string;
  value: unknown;
  source: 'override' | 'grandfather' | 'tier' | 'default';
  is_grandfathered: boolean;
  expires_at?: string;
}

export interface ResolvedFeatures {
  tier: string;
  features: Record<string, unknown>;
  limits: Record<string, number>;
  detailed: UserFeature[];
}

export interface UserOverride {
  id: string;
  user_id: string;
  feature_slug: string;
  feature_name: string;
  value: unknown;
  reason?: string;
  granted_by?: string;
  expires_at?: string;
  created_at: string;
}

@Injectable()
export class UserFeaturesService {
  private readonly logger = new Logger(UserFeaturesService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Get all features for a user with resolution
   */
  async getUserFeatures(userId: string, tierSlug?: string): Promise<ResolvedFeatures> {
    const client = this.supabase.getClient();

    // Get user's tier (default to 'free' if not set)
    const effectiveTier = tierSlug || 'free';

    // Get all feature definitions
    const { data: features } = await client
      .from('feature_definitions')
      .select('*')
      .eq('is_active', true);

    // Get tier features
    const { data: tierFeatures } = await client
      .from('tier_features')
      .select('feature_id, value')
      .eq('tier_id', (
        await client
          .from('subscription_tiers')
          .select('id')
          .eq('slug', effectiveTier)
          .single()
      ).data?.id);

    // Get user overrides
    const { data: overrides } = await client
      .from('user_feature_overrides')
      .select('feature_id, value, reason, expires_at')
      .eq('user_id', userId)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

    // Get grandfathered features
    const { data: grandfathered } = await client
      .from('user_grandfathering')
      .select('feature_id, original_feature_value, grandfathered_type, original_tier_snapshot, expires_at')
      .eq('user_id', userId)
      .eq('is_active', true)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

    // Build feature lookup maps
    const tierFeatureMap = new Map<string, unknown>();
    for (const tf of tierFeatures || []) {
      tierFeatureMap.set(tf.feature_id, tf.value);
    }

    const overrideMap = new Map<string, { value: unknown; expires_at?: string }>();
    for (const o of overrides || []) {
      overrideMap.set(o.feature_id, { value: o.value, expires_at: o.expires_at });
    }

    const grandfatherMap = new Map<string, { value: unknown; expires_at?: string }>();
    for (const g of grandfathered || []) {
      if (g.grandfathered_type === 'feature' && g.feature_id) {
        grandfatherMap.set(g.feature_id, {
          value: g.original_feature_value,
          expires_at: g.expires_at,
        });
      }
    }

    // Resolve features
    const resolved: ResolvedFeatures = {
      tier: effectiveTier,
      features: {},
      limits: {},
      detailed: [],
    };

    for (const feature of features || []) {
      let value: unknown = feature.default_value;
      let source: UserFeature['source'] = 'default';
      let isGrandfathered = false;
      let expiresAt: string | undefined;

      // Priority: override > grandfather > tier > default
      if (overrideMap.has(feature.id)) {
        const override = overrideMap.get(feature.id)!;
        value = override.value;
        source = 'override';
        expiresAt = override.expires_at;
      } else if (grandfatherMap.has(feature.id)) {
        const gf = grandfatherMap.get(feature.id)!;
        value = gf.value;
        source = 'grandfather';
        isGrandfathered = true;
        expiresAt = gf.expires_at;
      } else if (tierFeatureMap.has(feature.id)) {
        value = tierFeatureMap.get(feature.id);
        source = 'tier';
      }

      // Parse value based on type
      const parsedValue = this.parseValue(value, feature.value_type);

      resolved.features[feature.slug] = parsedValue;

      // Track limits (integer features)
      if (feature.value_type === 'integer') {
        resolved.limits[feature.slug] = parsedValue as number;
      }

      resolved.detailed.push({
        slug: feature.slug,
        name: feature.name,
        category: feature.category,
        value_type: feature.value_type,
        value: parsedValue,
        source,
        is_grandfathered: isGrandfathered,
        expires_at: expiresAt,
      });
    }

    return resolved;
  }

  /**
   * Check if a user has access to a specific feature
   */
  async hasFeature(userId: string, featureSlug: string, tierSlug?: string): Promise<boolean> {
    const resolved = await this.getUserFeatures(userId, tierSlug);
    const value = resolved.features[featureSlug];

    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'number') {
      return value !== 0 && value !== -1 ? true : value === -1;
    }
    return !!value;
  }

  /**
   * Get a feature limit for a user
   */
  async getFeatureLimit(userId: string, featureSlug: string, tierSlug?: string): Promise<number> {
    const resolved = await this.getUserFeatures(userId, tierSlug);
    return resolved.limits[featureSlug] ?? 0;
  }

  /**
   * Create a user override
   */
  async createOverride(
    userId: string,
    featureSlug: string,
    value: unknown,
    options?: {
      reason?: string;
      grantedBy?: string;
      expiresAt?: string;
    },
  ): Promise<void> {
    const client = this.supabase.getClient();

    // Get feature ID
    const { data: feature } = await client
      .from('feature_definitions')
      .select('id')
      .eq('slug', featureSlug)
      .single();

    if (!feature) {
      throw new Error(`Feature not found: ${featureSlug}`);
    }

    const { error } = await client.from('user_feature_overrides').upsert({
      user_id: userId,
      feature_id: feature.id,
      value,
      reason: options?.reason,
      granted_by: options?.grantedBy,
      expires_at: options?.expiresAt,
    }, {
      onConflict: 'user_id,feature_id',
    });

    if (error) {
      throw new Error(error.message);
    }

    this.logger.log(`Created override for user ${userId}: ${featureSlug} = ${JSON.stringify(value)}`);
  }

  /**
   * Remove a user override
   */
  async removeOverride(userId: string, featureSlug: string): Promise<void> {
    const client = this.supabase.getClient();

    const { data: feature } = await client
      .from('feature_definitions')
      .select('id')
      .eq('slug', featureSlug)
      .single();

    if (!feature) return;

    await client
      .from('user_feature_overrides')
      .delete()
      .eq('user_id', userId)
      .eq('feature_id', feature.id);

    this.logger.log(`Removed override for user ${userId}: ${featureSlug}`);
  }

  /**
   * Get all overrides for a user
   */
  async getUserOverrides(userId: string): Promise<UserOverride[]> {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('user_feature_overrides')
      .select(`
        id,
        user_id,
        value,
        reason,
        granted_by,
        expires_at,
        created_at,
        feature:feature_definitions(slug, name)
      `)
      .eq('user_id', userId);

    if (error) {
      throw new Error(error.message);
    }

    return (data || []).map((d: any) => ({
      id: d.id,
      user_id: d.user_id,
      feature_slug: d.feature?.slug,
      feature_name: d.feature?.name,
      value: d.value,
      reason: d.reason,
      granted_by: d.granted_by,
      expires_at: d.expires_at,
      created_at: d.created_at,
    }));
  }

  private parseValue(value: unknown, type: string): unknown {
    if (value === null || value === undefined) {
      return type === 'boolean' ? false : type === 'integer' ? 0 : null;
    }

    // Handle JSONB values that might be wrapped
    const unwrapped = typeof value === 'object' ? value : value;

    switch (type) {
      case 'boolean':
        return unwrapped === true || unwrapped === 'true';
      case 'integer':
        return parseInt(String(unwrapped), 10) || 0;
      case 'json':
        return unwrapped;
      default:
        return unwrapped;
    }
  }
}
