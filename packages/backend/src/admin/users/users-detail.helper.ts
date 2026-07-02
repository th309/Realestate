import { SupabaseClient } from '@supabase/supabase-js';
import { UserFeaturesService } from '../features/user-features.service';
import { UserDetail, UserStats } from './users.types';

export async function fetchUserDetail(
  client: SupabaseClient,
  userFeatures: UserFeaturesService,
  userId: string,
): Promise<UserDetail | null> {
  // Get profile with all fields
  const { data: profile } = await client
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (!profile) {
    return null;
  }

  // Get all related data
  const [overrides, trial, grandfather, org] = await Promise.all([
    userFeatures.getUserOverrides(userId),
    client
      .from('user_trials')
      .select('*')
      .eq('user_id', userId)
      .is('converted_at', null)
      .is('cancelled_at', null)
      .gt('expires_at', new Date().toISOString())
      .single()
      .then((r) => r.data),
    client
      .from('user_grandfathering')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single()
      .then((r) => r.data),
    profile.organization_id
      ? client
          .from('organizations')
          .select('*')
          .eq('id', profile.organization_id)
          .single()
          .then((r) => r.data)
      : Promise.resolve(null),
  ]);

  // Check beta tester
  const { data: betaTester } = await client
    .from('beta_testers')
    .select('id')
    .eq('email', profile.email)
    .eq('is_active', true)
    .single();

  // Get usage counts
  const [overrideCount, paywallCount, savedQueries, watchlist, alerts] =
    await Promise.all([
      client
        .from('user_feature_overrides')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .then((r) => r.count || 0),
      client
        .from('paywall_events')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('event_type', 'view')
        .then((r) => r.count || 0),
      client
        .from('analytics_saved_queries')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .then((r) => r.count || 0),
      client
        .from('analytics_watchlist')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .then((r) => r.count || 0),
      client
        .from('analytics_alerts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_active', true)
        .then((r) => r.count || 0),
    ]);

  return {
    id: profile.id,
    email: profile.email || '',
    name: profile.full_name || profile.email?.split('@')[0] || 'Unknown',
    tier: profile.subscription_tier || 'free',
    tierStatus: profile.subscription_status || 'active',
    createdAt: profile.created_at,
    lastActive:
      profile.last_login_at || profile.updated_at || profile.created_at,
    trialActive: !!trial,
    trialExpiresAt: trial?.expires_at,
    trialTier: trial?.tier,
    grandfathered: !!grandfather,
    grandfatheredType: grandfather?.grandfathered_type,
    grandfatheredReason: grandfather?.reason,
    organizationId: profile.organization_id,
    organizationName: org?.name,
    organizationRole: profile.organization_role,
    stripeCustomerId: profile.stripe_customer_id,
    stripeSubscriptionId: profile.stripe_subscription_id,
    isBetaTester: !!betaTester,
    betaTesterId: betaTester?.id,
    overrideCount,
    paywallHits: paywallCount,
    reportsGenerated: profile.reports_generated_this_month || 0,
    savedQueriesCount: savedQueries,
    watchlistCount: watchlist,
    alertsCount: alerts,
    overrides,
    grandfatheringDetails: grandfather
      ? {
          originalPrice: grandfather.original_price_monthly,
          originalTier: grandfather.original_tier_slug,
          effectiveFrom: grandfather.effective_from,
          expiresAt: grandfather.expires_at,
        }
      : undefined,
  };
}

export async function fetchUserStats(
  client: SupabaseClient,
): Promise<UserStats> {
  // Run all queries in parallel
  const [
    totalUsersResult,
    overridesResult,
    trialsResult,
    grandfatheredResult,
    betaTestersResult,
    orgUsersResult,
    stripeUsersResult,
    tierBreakdown,
  ] = await Promise.all([
    // Total users
    client.from('user_profiles').select('*', { count: 'exact', head: true }),
    // Users with overrides
    client.from('user_feature_overrides').select('user_id').limit(10000),
    // Active trials
    client
      .from('user_trials')
      .select('*', { count: 'exact', head: true })
      .is('converted_at', null)
      .is('cancelled_at', null)
      .gt('expires_at', new Date().toISOString()),
    // Grandfathered users
    client
      .from('user_grandfathering')
      .select('user_id')
      .eq('is_active', true)
      .limit(10000),
    // Beta testers
    client
      .from('beta_testers')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true),
    // Users in organizations
    client
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })
      .not('organization_id', 'is', null),
    // Users with Stripe
    client
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })
      .not('stripe_customer_id', 'is', null),
    // Tier breakdown
    client.from('user_profiles').select('subscription_tier'),
  ]);

  // Calculate unique counts
  const uniqueOverrideUsers = new Set(
    (overridesResult.data || []).map((u) => u.user_id),
  ).size;
  const uniqueGrandfathered = new Set(
    (grandfatheredResult.data || []).map((u) => u.user_id),
  ).size;

  // Calculate tier breakdown
  const byTier: Record<string, number> = {};
  (tierBreakdown.data || []).forEach((u) => {
    const tier = u.subscription_tier || 'free';
    byTier[tier] = (byTier[tier] || 0) + 1;
  });

  return {
    totalUsers: totalUsersResult.count || 0,
    withOverrides: uniqueOverrideUsers,
    activeTrials: trialsResult.count || 0,
    grandfathered: uniqueGrandfathered,
    betaTesters: betaTestersResult.count || 0,
    inOrganizations: orgUsersResult.count || 0,
    withStripe: stripeUsersResult.count || 0,
    byTier,
  };
}
