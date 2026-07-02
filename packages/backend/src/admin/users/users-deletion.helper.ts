import { Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';

export async function deleteOrganizationCascade(
  client: SupabaseClient,
  logger: Logger,
  orgId: string,
): Promise<void> {
  // 1. Get all member user IDs before cascade deletes them
  const { data: members } = await client
    .from('organization_members')
    .select('user_id')
    .eq('organization_id', orgId);

  const memberUserIds = (members || []).map((m) => m.user_id);

  // 2. Clear organization_id and organization_role on member profiles
  // (these columns are NOT FK-cascaded — they'd become dangling refs)
  if (memberUserIds.length > 0) {
    await client
      .from('user_profiles')
      .update({
        organization_id: null,
        organization_role: null,
        updated_at: new Date().toISOString(),
      })
      .in('id', memberUserIds);
  }

  // 3. Delete org row (FK CASCADE handles members, invites, api_keys, embed_tokens, audit_log)
  // reports.organization_id is ON DELETE SET NULL — reports survive
  const { error } = await client.from('organizations').delete().eq('id', orgId);

  if (error) {
    logger.error(`Failed to delete organization ${orgId}: ${error.message}`);
    throw new Error('Failed to delete organization');
  }

  logger.log(
    `Deleted organization ${orgId}, cleared ${memberUserIds.length} member profiles`,
  );
}

export async function deleteUserCascade(
  client: SupabaseClient,
  logger: Logger,
  userId: string,
): Promise<void> {
  // Clean up all dependent rows before deleting profile and auth user.
  // Tables with FK to user_profiles(id) or auth.users(id) without ON DELETE CASCADE
  // must be cleared first, plus tables with user_id columns referencing this user.
  const dependentTables = [
    { table: 'user_feature_overrides', column: 'user_id' },
    { table: 'user_grandfathering', column: 'user_id' },
    { table: 'user_trials', column: 'user_id' },
    { table: 'paywall_events', column: 'user_id' },
    { table: 'reports', column: 'user_id' },
    { table: 'report_conversations', column: 'user_id' },
    { table: 'user_report_memory', column: 'user_id' },
    { table: 'report_templates', column: 'created_by' },
    { table: 'user_alerts', column: 'user_id' },
    { table: 'analytics_saved_queries', column: 'user_id' },
    { table: 'analytics_watchlist', column: 'user_id' },
    { table: 'analytics_alerts', column: 'user_id' },
    { table: 'email_log', column: 'user_id' },
    { table: 'email_triggers', column: 'user_id' },
    { table: 'user_sessions', column: 'user_id' },
    { table: 'user_events', column: 'user_id' },
    { table: 'analytics_events', column: 'user_id' },
    { table: 'visitor_identities', column: 'user_id' },
  ];

  // Tables where we nullify the reference instead of deleting the row
  // (shared resources like audit logs, configs, org assets)
  const nullifyTables = [
    { table: 'trial_config', column: 'updated_by' },
    { table: 'organization_audit_log', column: 'actor_id' },
    { table: 'organization_api_keys', column: 'created_by' },
    { table: 'organization_embed_tokens', column: 'created_by' },
    { table: 'organization_invites', column: 'invited_by' },
    { table: 'funnel_definitions', column: 'created_by' },
    { table: 'analytics_annotations', column: 'created_by' },
  ];

  for (const { table, column } of dependentTables) {
    const { error } = await client.from(table).delete().eq(column, userId);
    if (error) {
      logger.warn(
        `Failed to clean ${table} for user ${userId}: ${error.message}`,
      );
      // Continue — table may not exist or have no rows for this user
    }
  }

  for (const { table, column } of nullifyTables) {
    const { error } = await client
      .from(table)
      .update({ [column]: null })
      .eq(column, userId);
    if (error) {
      logger.warn(
        `Failed to nullify ${table}.${column} for user ${userId}: ${error.message}`,
      );
    }
  }

  // Delete user_profiles row
  const { error: profileError } = await client
    .from('user_profiles')
    .delete()
    .eq('id', userId);

  if (profileError) {
    logger.error(`Failed to delete user_profiles for ${userId}`, profileError);
    throw new Error(profileError.message);
  }

  // Delete auth user (may already be gone if profile was orphaned)
  const { error: authError } = await client.auth.admin.deleteUser(userId);

  if (authError) {
    const msg = authError.message?.toLowerCase() ?? '';
    if (msg.includes('not found') || msg.includes('user not found')) {
      logger.warn(
        `Auth user ${userId} already deleted — cleaning up orphaned profile`,
      );
    } else {
      logger.error(`Failed to delete auth user ${userId}`, authError);
      throw new Error(authError.message);
    }
  }

  logger.log(`Admin deleted user ${userId}`);
}
