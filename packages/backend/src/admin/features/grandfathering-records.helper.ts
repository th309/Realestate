/**
 * Grandfathering Records Helpers
 *
 * CRUD operations for grandfathered records plus the audit-log writer.
 * Each function takes the SupabaseClient explicitly (no `this`).
 */

import { Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import {
  CreateGrandfatherDto,
  GrandfatheredRecord,
} from './grandfathering.types';

/**
 * Write an entry to the grandfathering audit log.
 */
export async function logGrandfatheringAudit(
  client: SupabaseClient,
  action: string,
  userId: string | null,
  entityId: string,
  data: unknown,
): Promise<void> {
  await client.from('feature_audit_log').insert({
    action,
    entity_type: 'grandfathering',
    entity_id: entityId,
    new_value: data,
    performed_by: userId,
  });
}

/**
 * Get all grandfathered records for a user
 */
export async function getUserGrandfathering(
  client: SupabaseClient,
  logger: Logger,
  userId: string,
): Promise<GrandfatheredRecord[]> {
  const { data, error } = await client
    .from('user_grandfathering')
    .select(
      `
        *,
        feature:feature_definitions(slug, name)
      `,
    )
    .eq('user_id', userId)
    .eq('is_active', true)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

  if (error) {
    logger.error(`Failed to get user grandfathering: ${error.message}`);
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
export async function getAllActiveGrandfathering(
  client: SupabaseClient,
): Promise<GrandfatheredRecord[]> {
  const { data, error } = await client
    .from('user_grandfathering')
    .select(
      `
        *,
        feature:feature_definitions(slug, name)
      `,
    )
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
export async function createGrandfathering(
  client: SupabaseClient,
  logger: Logger,
  dto: CreateGrandfatherDto,
): Promise<GrandfatheredRecord> {
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

  logger.log(
    `Created grandfathering for user ${dto.user_id}: ${dto.grandfathered_type}`,
  );

  // Log to audit
  await logGrandfatheringAudit(
    client,
    'create_grandfather',
    dto.user_id,
    data.id,
    insertData,
  );

  return data;
}

/**
 * Revoke a grandfathered record
 */
export async function revokeGrandfathering(
  client: SupabaseClient,
  logger: Logger,
  grandfatherId: string,
  revokedBy?: string,
  reason?: string,
): Promise<void> {
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

  logger.log(`Revoked grandfathering ${grandfatherId}`);

  await logGrandfatheringAudit(
    client,
    'revoke_grandfather',
    null,
    grandfatherId,
    {
      reason,
    },
  );
}

/**
 * Extend grandfathering expiration
 */
export async function extendGrandfathering(
  client: SupabaseClient,
  logger: Logger,
  grandfatherId: string,
  newExpiresAt: string,
): Promise<void> {
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

  logger.log(`Extended grandfathering ${grandfatherId} to ${newExpiresAt}`);
}
