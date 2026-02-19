/**
 * Features Service
 *
 * CRUD operations for feature definitions and tier feature matrix.
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { RedisService } from '../../redis/redis.service';

export interface FeatureDefinition {
  id: string;
  slug: string;
  name: string;
  description?: string;
  category: string;
  value_type: 'boolean' | 'integer' | 'string' | 'json';
  default_value: unknown;
  is_active: boolean;
  is_enforced: boolean;
  created_at: string;
  updated_at: string;
}

export interface TierFeature {
  id: string;
  tier_id: string;
  feature_id: string;
  value: unknown;
  tier_slug?: string;
  feature_slug?: string;
}

export interface FeatureMatrix {
  features: FeatureDefinition[];
  tiers: Array<{
    id: string;
    slug: string;
    name: string;
    values: Record<string, unknown>;
  }>;
}

@Injectable()
export class FeaturesService {
  private readonly logger = new Logger(FeaturesService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Get all feature definitions
   */
  async getAllFeatures(): Promise<FeatureDefinition[]> {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('feature_definitions')
      .select('*')
      .order('category')
      .order('name');

    if (error) {
      this.logger.error(`Failed to get features: ${error.message}`);
      throw new Error(error.message);
    }

    return data || [];
  }

  /**
   * Get features grouped by category
   */
  async getFeaturesByCategory(): Promise<Record<string, FeatureDefinition[]>> {
    const features = await this.getAllFeatures();
    const grouped: Record<string, FeatureDefinition[]> = {};

    for (const feature of features) {
      if (!grouped[feature.category]) {
        grouped[feature.category] = [];
      }
      grouped[feature.category].push(feature);
    }

    return grouped;
  }

  /**
   * Get full feature matrix (features x tiers)
   */
  async getFeatureMatrix(): Promise<FeatureMatrix> {
    const client = this.supabase.getClient();

    // Get features
    const { data: features, error: featuresError } = await client
      .from('feature_definitions')
      .select('*')
      .eq('is_active', true)
      .order('category')
      .order('name');

    if (featuresError) {
      throw new Error(featuresError.message);
    }

    // Get tiers
    const { data: tiers, error: tiersError } = await client
      .from('subscription_tiers')
      .select('id, slug, name')
      .eq('is_active', true)
      .order('display_order');

    if (tiersError) {
      throw new Error(tiersError.message);
    }

    // Get tier_features
    const { data: tierFeatures, error: tfError } = await client
      .from('tier_features')
      .select('tier_id, feature_id, value');

    if (tfError) {
      throw new Error(tfError.message);
    }

    // Build matrix
    const tierValues: Record<string, Record<string, unknown>> = {};
    for (const tf of tierFeatures || []) {
      if (!tierValues[tf.tier_id]) {
        tierValues[tf.tier_id] = {};
      }
      const feature = features?.find((f) => f.id === tf.feature_id);
      if (feature) {
        tierValues[tf.tier_id][feature.slug] = tf.value;
      }
    }

    return {
      features: features || [],
      tiers: (tiers || []).map((tier) => ({
        id: tier.id,
        slug: tier.slug,
        name: tier.name,
        values: tierValues[tier.id] || {},
      })),
    };
  }

  /**
   * Update a tier feature value
   */
  async updateTierFeature(
    tierSlug: string,
    featureSlug: string,
    value: unknown,
  ): Promise<void> {
    const client = this.supabase.getClient();

    // Get tier and feature IDs
    const { data: tier } = await client
      .from('subscription_tiers')
      .select('id')
      .eq('slug', tierSlug)
      .single();

    const { data: feature } = await client
      .from('feature_definitions')
      .select('id')
      .eq('slug', featureSlug)
      .single();

    if (!tier || !feature) {
      throw new Error('Tier or feature not found');
    }

    // Upsert the value
    const { error } = await client
      .from('tier_features')
      .upsert({
        tier_id: tier.id,
        feature_id: feature.id,
        value,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'tier_id,feature_id',
      });

    if (error) {
      this.logger.error(`Failed to update tier feature: ${error.message}`);
      throw new Error(error.message);
    }

    // Invalidate entitlements cache for all tiers (changing one tier can affect tierRequired lookups)
    await this.redis.deleteByPrefix('entitlements:');

    // Log to audit
    await this.logAudit('update_tier_feature', 'tier_feature', null, {
      tier: tierSlug,
      feature: featureSlug,
      value,
    });

    this.logger.log(`Updated ${tierSlug}.${featureSlug} = ${JSON.stringify(value)}`);
  }

  /**
   * Bulk update tier features
   */
  async bulkUpdateTierFeatures(
    tierSlug: string,
    updates: Record<string, unknown>,
  ): Promise<void> {
    for (const [featureSlug, value] of Object.entries(updates)) {
      await this.updateTierFeature(tierSlug, featureSlug, value);
    }
  }

  /**
   * Create a new feature definition
   */
  async createFeature(data: {
    slug: string;
    name: string;
    description?: string;
    category: string;
    value_type: string;
    default_value: unknown;
  }): Promise<FeatureDefinition> {
    const client = this.supabase.getClient();

    const { data: feature, error } = await client
      .from('feature_definitions')
      .insert(data)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    await this.logAudit('create_feature', 'feature_definition', feature.id, data);
    return feature;
  }

  /**
   * Update a feature definition
   */
  async updateFeature(
    slug: string,
    updates: Partial<FeatureDefinition>,
  ): Promise<FeatureDefinition> {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('feature_definitions')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('slug', slug)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    await this.logAudit('update_feature', 'feature_definition', data.id, updates);
    return data;
  }

  /**
   * Get pricing summary for the public pricing page.
   * Returns tier info + feature bullets grouped by category.
   */
  async getPricingSummary(): Promise<{
    tiers: Array<{
      slug: string;
      name: string;
      price_monthly: string | null;
      price_yearly: string | null;
      description: string | null;
      features: Array<{
        slug: string;
        name: string;
        category: string;
        value: unknown;
        value_type: string;
      }>;
    }>;
  }> {
    const client = this.supabase.getClient();

    // Get active tiers (exclude admin)
    const { data: tiers, error: tiersError } = await client
      .from('subscription_tiers')
      .select('id, slug, name, description, price_monthly, price_yearly, display_order')
      .eq('is_active', true)
      .neq('slug', 'admin')
      .order('display_order');

    if (tiersError) throw new Error(tiersError.message);

    // Get enforced, active features
    const { data: features, error: featuresError } = await client
      .from('feature_definitions')
      .select('id, slug, name, category, value_type')
      .eq('is_active', true)
      .eq('is_enforced', true)
      .order('category')
      .order('name');

    if (featuresError) throw new Error(featuresError.message);

    // Get tier_features values
    const { data: tierFeatures, error: tfError } = await client
      .from('tier_features')
      .select('tier_id, feature_id, value');

    if (tfError) throw new Error(tfError.message);

    // Build lookup: tier_id -> feature_id -> value
    const tfLookup: Record<string, Record<string, unknown>> = {};
    for (const tf of tierFeatures || []) {
      if (!tfLookup[tf.tier_id]) tfLookup[tf.tier_id] = {};
      tfLookup[tf.tier_id][tf.feature_id] = tf.value;
    }

    return {
      tiers: (tiers || []).map(tier => ({
        slug: tier.slug,
        name: tier.name,
        price_monthly: tier.price_monthly,
        price_yearly: tier.price_yearly,
        description: tier.description,
        features: (features || [])
          .map(f => ({
            slug: f.slug,
            name: f.name,
            category: f.category,
            value: tfLookup[tier.id]?.[f.id] ?? null,
            value_type: f.value_type,
          }))
          .filter(f => f.value === true || (typeof f.value === 'number' && f.value !== 0) || f.value === 'true'),
      })),
    };
  }

  private async logAudit(
    action: string,
    entityType: string,
    entityId: string | null,
    data: unknown,
  ): Promise<void> {
    const client = this.supabase.getClient();

    await client.from('feature_audit_log').insert({
      action,
      entity_type: entityType,
      entity_id: entityId,
      new_value: data,
    });
  }
}
