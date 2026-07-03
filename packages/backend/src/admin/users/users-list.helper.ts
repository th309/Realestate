import { Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { UserListItem } from './users.types';
import {
  getTrialsForUsers,
  getOverrideCountsForUsers,
  getPaywallCountsForUsers,
  getGrandfathersForUsers,
  getBetaTestersForUsers,
  getOrganizationsForUsers,
  getSavedQueryCountsForUsers,
  getWatchlistCountsForUsers,
  getAlertCountsForUsers,
} from './users-batch-fetch.helper';

export async function fetchUsersList(
  client: SupabaseClient,
  logger: Logger,
  options?: {
    search?: string;
    tier?: string;
    organizationId?: string;
    sort?: string;
    limit?: number;
    offset?: number;
  },
): Promise<{ users: UserListItem[]; total: number }> {
  const limit = options?.limit || 50;
  const offset = options?.offset || 0;

  // Query user_profiles with all relevant fields
  let query = client
    .from('user_profiles')
    .select(
      `
        id, email, full_name, subscription_tier, subscription_status,
        stripe_customer_id, stripe_subscription_id,
        organization_id, organization_role,
        reports_generated_this_month,
        created_at, updated_at, last_login_at
      `,
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (options?.search) {
    query = query.or(
      `email.ilike.%${options.search}%,full_name.ilike.%${options.search}%`,
    );
  }

  if (options?.tier) {
    query = query.eq('subscription_tier', options.tier);
  }

  if (options?.organizationId) {
    query = query.eq('organization_id', options.organizationId);
  }

  const { data: profiles, count, error } = await query;

  if (error) {
    logger.error('Failed to fetch user_profiles', error);
    return { users: [], total: 0 };
  }

  // Batch fetch related data for efficiency
  const userIds = (profiles || []).map((p) => p.id);

  // Fetch all related data in parallel
  const [
    trials,
    overrideCounts,
    paywallCounts,
    grandfathers,
    betaTesters,
    organizations,
    savedQueries,
    watchlists,
    alerts,
  ] = await Promise.all([
    getTrialsForUsers(client, userIds),
    getOverrideCountsForUsers(client, userIds),
    getPaywallCountsForUsers(client, userIds),
    getGrandfathersForUsers(client, userIds),
    getBetaTestersForUsers(client, profiles?.map((p) => p.email) || []),
    getOrganizationsForUsers(client, [
      ...new Set(profiles?.map((p) => p.organization_id).filter(Boolean) || []),
    ]),
    getSavedQueryCountsForUsers(client, userIds),
    getWatchlistCountsForUsers(client, userIds),
    getAlertCountsForUsers(client, userIds),
  ]);

  const users: UserListItem[] = (profiles || []).map((profile) => {
    const trial = trials.get(profile.id);
    const grandfather = grandfathers.get(profile.id);
    const betaTester = betaTesters.get(profile.email?.toLowerCase());
    const org = profile.organization_id
      ? organizations.get(profile.organization_id)
      : null;

    return {
      id: profile.id,
      email: profile.email || '',
      name: profile.full_name || profile.email?.split('@')[0] || 'Unknown',
      tier: profile.subscription_tier || 'free',
      tierStatus: profile.subscription_status || 'active',
      createdAt: profile.created_at,
      lastActive:
        profile.last_login_at || profile.updated_at || profile.created_at,
      // Trial
      trialActive: !!trial,
      trialExpiresAt: trial?.expires_at,
      trialTier: trial?.tier,
      // Grandfathering
      grandfathered: !!grandfather,
      grandfatheredType: grandfather?.grandfathered_type,
      grandfatheredReason: grandfather?.reason,
      // Organization
      organizationId: profile.organization_id,
      organizationName: org?.name,
      organizationRole: profile.organization_role,
      // Stripe
      stripeCustomerId: profile.stripe_customer_id,
      stripeSubscriptionId: profile.stripe_subscription_id,
      // Beta
      isBetaTester: !!betaTester,
      betaTesterId: betaTester?.id,
      // Usage
      overrideCount: overrideCounts.get(profile.id) || 0,
      paywallHits: paywallCounts.get(profile.id) || 0,
      reportsGenerated: profile.reports_generated_this_month || 0,
      savedQueriesCount: savedQueries.get(profile.id) || 0,
      watchlistCount: watchlists.get(profile.id) || 0,
      alertsCount: alerts.get(profile.id) || 0,
    };
  });

  // Sort by organization name in JS (org name comes from a join, not the query)
  if (options?.sort === 'organization') {
    users.sort((a, b) => {
      const nameA = (a.organizationName || '').toLowerCase();
      const nameB = (b.organizationName || '').toLowerCase();
      if (!nameA && !nameB) return 0;
      if (!nameA) return 1;
      if (!nameB) return -1;
      return nameA.localeCompare(nameB);
    });
  }

  return { users, total: count || 0 };
}

export async function fetchOrganizationsList(client: SupabaseClient): Promise<{
  organizations: { id: string; name: string; slug: string }[];
}> {
  const { data } = await client
    .from('organizations')
    .select('id, name, slug')
    .order('name');
  return { organizations: data || [] };
}
