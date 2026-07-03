/**
 * Grandfathering Policy Helpers
 *
 * CRUD operations for grandfathering policies.
 * Each function takes the SupabaseClient explicitly (no `this`).
 */

import { Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { GrandfatherPolicy } from './grandfathering.types';

/**
 * Get all grandfathering policies
 */
export async function getPolicies(
  client: SupabaseClient,
): Promise<GrandfatherPolicy[]> {
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
export async function getActivePolicies(
  client: SupabaseClient,
): Promise<GrandfatherPolicy[]> {
  const policies = await getPolicies(client);
  return policies.filter((p) => p.is_active);
}

/**
 * Create a new policy
 */
export async function createPolicy(
  client: SupabaseClient,
  logger: Logger,
  policy: Omit<GrandfatherPolicy, 'id'>,
): Promise<GrandfatherPolicy> {
  const { data, error } = await client
    .from('grandfather_policies')
    .insert(policy)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  logger.log(`Created policy: ${policy.name}`);
  return data;
}

/**
 * Update a policy
 */
export async function updatePolicy(
  client: SupabaseClient,
  policyId: string,
  updates: Partial<GrandfatherPolicy>,
): Promise<GrandfatherPolicy> {
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
export async function deletePolicy(
  client: SupabaseClient,
  logger: Logger,
  policyId: string,
): Promise<void> {
  const { error } = await client
    .from('grandfather_policies')
    .delete()
    .eq('id', policyId);

  if (error) {
    throw new Error(error.message);
  }

  logger.log(`Deleted policy ${policyId}`);
}
