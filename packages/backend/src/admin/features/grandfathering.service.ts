/**
 * Grandfathering Service
 *
 * Manages grandfathered pricing and features for users.
 * Includes policy engine for automatic grandfathering on tier changes.
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';

export interface GrandfatheredRecord {
  id: string;
  user_id: string;
  grandfathered_type: 'tier' | 'feature' | 'pricing';
  original_price_monthly?: number;
  original_price_yearly?: number;
  original_tier_slug?: string;
  original_tier_snapshot?: Record<string, unknown>;
  feature_id?: string;
  feature_slug?: string;
  original_feature_value?: unknown;
  reason: string;
  notes?: string;
  grandfathered_at: string;
  effective_from: string;
  expires_at?: string;
  granted_by?: string;
  grant_source?: string;
  is_active: boolean;
  revoked_at?: string;
  revoked_by?: string;
  revoke_reason?: string;
}

export interface GrandfatherPolicy {
  id: string;
  name: string;
  description?: string;
  trigger_type: 'tier_change' | 'price_increase' | 'feature_removal' | 'manual';
  trigger_condition: {
    from_tier?: string;
    to_tier?: string;
    price_increase_threshold?: number;
    feature_slugs?: string[];
  };
  grandfather_type: 'tier' | 'feature' | 'pricing';
  grandfather_config?: {
    preserve_features?: string[];
    preserve_pricing?: boolean;
    preserve_tier_snapshot?: boolean;
  };
  duration_type: 'permanent' | 'months' | 'until_date';
  duration_months?: number;
  is_active: boolean;
  priority: number;
}

export interface CreateGrandfatherDto {
  user_id: string;
  grandfathered_type: 'tier' | 'feature' | 'pricing';
  original_price_monthly?: number;
  original_price_yearly?: number;
  original_tier_slug?: string;
  original_tier_snapshot?: Record<string, unknown>;
  feature_slug?: string;
  original_feature_value?: unknown;
  reason: string;
  notes?: string;
  expires_at?: string;
  granted_by?: string;
  grant_source?: string;
}

@Injectable()
export class GrandfatheringService {
  private readonly logger = new Logger(GrandfatheringService.name);

  constructor(private readonly supabase: SupabaseService) {}

  // ========================================================================
  // GRANDFATHERED RECORDS
  // ========================================================================

  /**
   * Get all grandfathered records for a user
   */
  async getUserGrandfathering(userId: string): Promise<GrandfatheredRecord[]> {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('user_grandfathering')
      .select(`
        *,
        feature:feature_definitions(slug, name)
      `)
      .eq('user_id', userId)
      .eq('is_active', true)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

    if (error) {
      this.logger.error(`Failed to get user grandfathering: ${error.message}`);
      throw new Error(error.message);
    }

    return (data || []).map((d: any) => ({
      ...d,
      feature_slug: d.feature?.slug,
    }));
  }

  /**
   * Get all active grandfathered records (admin)
   */
  async getAllActiveGrandfathering(): Promise<GrandfatheredRecord[]> {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('user_grandfathering')
      .select(`
        *,
        feature:feature_definitions(slug, name)
      `)
      .eq('is_active', true)
      .order('grandfathered_at', { ascending: false })
      .limit(500);

    if (error) {
      throw new Error(error.message);
    }

    return (data || []).map((d: any) => ({
      ...d,
      feature_slug: d.feature?.slug,
    }));
  }

  /**
   * Create a grandfathered record
   */
  async createGrandfathering(dto: CreateGrandfatherDto): Promise<GrandfatheredRecord> {
    const client = this.supabase.getClient();

    // If feature_slug provided, resolve to feature_id
    let featureId: string | undefined;
    if (dto.feature_slug) {
      const { data: feature } = await client
        .from('feature_definitions')
        .select('id')
        .eq('slug', dto.feature_slug)
        .single();
      featureId = feature?.id;
    }

    const insertData = {
      user_id: dto.user_id,
      grandfathered_type: dto.grandfathered_type,
      original_price_monthly: dto.original_price_monthly,
      original_price_yearly: dto.original_price_yearly,
      original_tier_slug: dto.original_tier_slug,
      original_tier_snapshot: dto.original_tier_snapshot,
      feature_id: featureId,
      original_feature_value: dto.original_feature_value,
      reason: dto.reason,
      notes: dto.notes,
      expires_at: dto.expires_at,
      granted_by: dto.granted_by,
      grant_source: dto.grant_source || 'admin',
    };

    const { data, error } = await client
      .from('user_grandfathering')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    this.logger.log(`Created grandfathering for user ${dto.user_id}: ${dto.grandfathered_type}`);

    // Log to audit
    await this.logAudit('create_grandfather', dto.user_id, data.id, insertData);

    return data;
  }

  /**
   * Revoke a grandfathered record
   */
  async revokeGrandfathering(
    grandfatherId: string,
    revokedBy?: string,
    reason?: string,
  ): Promise<void> {
    const client = this.supabase.getClient();

    const { error } = await client
      .from('user_grandfathering')
      .update({
        is_active: false,
        revoked_at: new Date().toISOString(),
        revoked_by: revokedBy,
        revoke_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', grandfatherId);

    if (error) {
      throw new Error(error.message);
    }

    this.logger.log(`Revoked grandfathering ${grandfatherId}`);

    await this.logAudit('revoke_grandfather', null, grandfatherId, { reason });
  }

  /**
   * Extend grandfathering expiration
   */
  async extendGrandfathering(grandfatherId: string, newExpiresAt: string): Promise<void> {
    const client = this.supabase.getClient();

    const { error } = await client
      .from('user_grandfathering')
      .update({
        expires_at: newExpiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', grandfatherId);

    if (error) {
      throw new Error(error.message);
    }

    this.logger.log(`Extended grandfathering ${grandfatherId} to ${newExpiresAt}`);
  }

  // ========================================================================
  // POLICY ENGINE
  // ========================================================================

  /**
   * Get all grandfathering policies
   */
  async getPolicies(): Promise<GrandfatherPolicy[]> {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('grandfather_policies')
      .select('*')
      .order('priority', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return data || [];
  }

  /**
   * Get active policies
   */
  async getActivePolicies(): Promise<GrandfatherPolicy[]> {
    const policies = await this.getPolicies();
    return policies.filter((p) => p.is_active);
  }

  /**
   * Apply policies on tier change
   */
  async applyPoliciesOnTierChange(
    userId: string,
    fromTier: string,
    toTier: string,
    grantedBy?: string,
  ): Promise<GrandfatheredRecord[]> {
    const client = this.supabase.getClient();
    const policies = await this.getActivePolicies();
    const created: GrandfatheredRecord[] = [];

    // Filter applicable policies
    const applicablePolicies = policies.filter((p) => {
      if (p.trigger_type !== 'tier_change') return false;
      const cond = p.trigger_condition;
      if (cond.from_tier && cond.from_tier !== fromTier) return false;
      if (cond.to_tier && cond.to_tier !== toTier) return false;
      return true;
    });

    if (applicablePolicies.length === 0) {
      this.logger.log(`No applicable policies for tier change ${fromTier} -> ${toTier}`);
      return [];
    }

    // Get current tier features to snapshot
    const { data: fromTierData } = await client
      .from('subscription_tiers')
      .select('*')
      .eq('slug', fromTier)
      .single();

    const { data: fromTierFeatures } = await client
      .from('tier_features')
      .select(`
        value,
        feature:feature_definitions(slug, name, value_type)
      `)
      .eq('tier_id', fromTierData?.id);

    const tierSnapshot: Record<string, unknown> = {
      tier: fromTierData,
      features: {},
    };

    for (const tf of fromTierFeatures || []) {
      const feature = (tf as any).feature;
      if (feature?.slug) {
        (tierSnapshot.features as Record<string, unknown>)[feature.slug] = tf.value;
      }
    }

    // Apply each policy
    for (const policy of applicablePolicies) {
      const expiresAt = this.calculateExpiration(policy);

      if (policy.grandfather_type === 'tier' || policy.grandfather_config?.preserve_tier_snapshot) {
        // Grandfather entire tier
        const record = await this.createGrandfathering({
          user_id: userId,
          grandfathered_type: 'tier',
          original_tier_slug: fromTier,
          original_tier_snapshot: tierSnapshot,
          original_price_monthly: fromTierData?.price_monthly,
          original_price_yearly: fromTierData?.price_yearly,
          reason: `Policy: ${policy.name}`,
          notes: `Applied on tier change from ${fromTier} to ${toTier}`,
          expires_at: expiresAt,
          granted_by: grantedBy,
          grant_source: 'policy',
        });
        created.push(record);
      }

      if (policy.grandfather_type === 'pricing' || policy.grandfather_config?.preserve_pricing) {
        // Grandfather pricing only
        const record = await this.createGrandfathering({
          user_id: userId,
          grandfathered_type: 'pricing',
          original_price_monthly: fromTierData?.price_monthly,
          original_price_yearly: fromTierData?.price_yearly,
          original_tier_slug: fromTier,
          reason: `Policy: ${policy.name}`,
          notes: `Pricing preserved from ${fromTier}`,
          expires_at: expiresAt,
          granted_by: grantedBy,
          grant_source: 'policy',
        });
        created.push(record);
      }

      if (policy.grandfather_type === 'feature' && policy.grandfather_config?.preserve_features) {
        // Grandfather specific features
        for (const featureSlug of policy.grandfather_config.preserve_features) {
          const featureValue = (tierSnapshot.features as Record<string, unknown>)[featureSlug];
          if (featureValue !== undefined) {
            const record = await this.createGrandfathering({
              user_id: userId,
              grandfathered_type: 'feature',
              feature_slug: featureSlug,
              original_feature_value: featureValue,
              original_tier_slug: fromTier,
              reason: `Policy: ${policy.name}`,
              notes: `Feature ${featureSlug} preserved from ${fromTier}`,
              expires_at: expiresAt,
              granted_by: grantedBy,
              grant_source: 'policy',
            });
            created.push(record);
          }
        }
      }
    }

    this.logger.log(`Applied ${created.length} grandfathering records for user ${userId}`);
    return created;
  }

  /**
   * Apply policies on price increase
   */
  async applyPoliciesOnPriceIncrease(
    tierSlug: string,
    oldPrice: number,
    newPrice: number,
  ): Promise<number> {
    const client = this.supabase.getClient();
    const policies = await this.getActivePolicies();

    // Filter applicable policies
    const applicablePolicies = policies.filter((p) => {
      if (p.trigger_type !== 'price_increase') return false;
      const cond = p.trigger_condition;
      if (cond.price_increase_threshold) {
        const increasePercent = ((newPrice - oldPrice) / oldPrice) * 100;
        return increasePercent >= cond.price_increase_threshold;
      }
      return true;
    });

    if (applicablePolicies.length === 0) {
      return 0;
    }

    // Get all users currently on this tier
    const { data: users } = await client
      .from('user_subscriptions')
      .select('user_id')
      .eq('tier_slug', tierSlug)
      .eq('status', 'active');

    let count = 0;
    for (const user of users || []) {
      for (const policy of applicablePolicies) {
        await this.createGrandfathering({
          user_id: user.user_id,
          grandfathered_type: 'pricing',
          original_price_monthly: oldPrice,
          original_tier_slug: tierSlug,
          reason: `Policy: ${policy.name}`,
          notes: `Price increase from $${oldPrice} to $${newPrice}`,
          expires_at: this.calculateExpiration(policy),
          grant_source: 'policy',
        });
        count++;
      }
    }

    this.logger.log(`Grandfathered pricing for ${count} users on tier ${tierSlug}`);
    return count;
  }

  /**
   * Create a new policy
   */
  async createPolicy(policy: Omit<GrandfatherPolicy, 'id'>): Promise<GrandfatherPolicy> {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('grandfather_policies')
      .insert(policy)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    this.logger.log(`Created policy: ${policy.name}`);
    return data;
  }

  /**
   * Update a policy
   */
  async updatePolicy(
    policyId: string,
    updates: Partial<GrandfatherPolicy>,
  ): Promise<GrandfatherPolicy> {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('grandfather_policies')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', policyId)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  /**
   * Delete a policy
   */
  async deletePolicy(policyId: string): Promise<void> {
    const client = this.supabase.getClient();

    const { error } = await client
      .from('grandfather_policies')
      .delete()
      .eq('id', policyId);

    if (error) {
      throw new Error(error.message);
    }

    this.logger.log(`Deleted policy ${policyId}`);
  }

  // ========================================================================
  // HELPERS
  // ========================================================================

  private calculateExpiration(policy: GrandfatherPolicy): string | undefined {
    if (policy.duration_type === 'permanent') {
      return undefined;
    }

    if (policy.duration_type === 'months' && policy.duration_months) {
      const expires = new Date();
      expires.setMonth(expires.getMonth() + policy.duration_months);
      return expires.toISOString();
    }

    return undefined;
  }

  private async logAudit(
    action: string,
    userId: string | null,
    entityId: string,
    data: unknown,
  ): Promise<void> {
    const client = this.supabase.getClient();

    await client.from('feature_audit_log').insert({
      action,
      entity_type: 'grandfathering',
      entity_id: entityId,
      new_value: data,
      performed_by: userId,
    });
  }
}
