/**
 * Grandfathering Policy Engine Helpers
 *
 * Applies grandfathering policies automatically on tier changes and price
 * increases. Each function takes the SupabaseClient explicitly (no `this`).
 */

import { Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { GrandfatheredRecord, GrandfatherPolicy } from './grandfathering.types';
import { createGrandfathering } from './grandfathering-records.helper';
import { getActivePolicies } from './grandfathering-policies.helper';

/**
 * Compute the expiration timestamp implied by a policy's duration config.
 */
export function calculateExpiration(
  policy: GrandfatherPolicy,
): string | undefined {
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

/**
 * Apply policies on tier change
 */
export async function applyPoliciesOnTierChange(
  client: SupabaseClient,
  logger: Logger,
  userId: string,
  fromTier: string,
  toTier: string,
  grantedBy?: string,
): Promise<GrandfatheredRecord[]> {
  const policies = await getActivePolicies(client);
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
    logger.log(
      `No applicable policies for tier change ${fromTier} -> ${toTier}`,
    );
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
    .select(
      `
        value,
        feature:feature_definitions(slug, name, value_type)
      `,
    )
    .eq('tier_id', fromTierData?.id);

  const tierSnapshot: Record<string, unknown> = {
    tier: fromTierData,
    features: {},
  };

  for (const tf of fromTierFeatures || []) {
    const feature = (tf as any).feature;
    if (feature?.slug) {
      (tierSnapshot.features as Record<string, unknown>)[feature.slug] =
        tf.value;
    }
  }

  // Apply each policy
  for (const policy of applicablePolicies) {
    const expiresAt = calculateExpiration(policy);

    if (
      policy.grandfather_type === 'tier' ||
      policy.grandfather_config?.preserve_tier_snapshot
    ) {
      // Grandfather entire tier
      const record = await createGrandfathering(client, logger, {
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

    if (
      policy.grandfather_type === 'pricing' ||
      policy.grandfather_config?.preserve_pricing
    ) {
      // Grandfather pricing only
      const record = await createGrandfathering(client, logger, {
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

    if (
      policy.grandfather_type === 'feature' &&
      policy.grandfather_config?.preserve_features
    ) {
      // Grandfather specific features
      for (const featureSlug of policy.grandfather_config.preserve_features) {
        const featureValue = (tierSnapshot.features as Record<string, unknown>)[
          featureSlug
        ];
        if (featureValue !== undefined) {
          const record = await createGrandfathering(client, logger, {
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

  logger.log(
    `Applied ${created.length} grandfathering records for user ${userId}`,
  );
  return created;
}

/**
 * Apply policies on price increase
 */
export async function applyPoliciesOnPriceIncrease(
  client: SupabaseClient,
  logger: Logger,
  tierSlug: string,
  oldPrice: number,
  newPrice: number,
): Promise<number> {
  const policies = await getActivePolicies(client);

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
      await createGrandfathering(client, logger, {
        user_id: user.user_id,
        grandfathered_type: 'pricing',
        original_price_monthly: oldPrice,
        original_tier_slug: tierSlug,
        reason: `Policy: ${policy.name}`,
        notes: `Price increase from $${oldPrice} to $${newPrice}`,
        expires_at: calculateExpiration(policy),
        grant_source: 'policy',
      });
      count++;
    }
  }

  logger.log(`Grandfathered pricing for ${count} users on tier ${tierSlug}`);
  return count;
}
