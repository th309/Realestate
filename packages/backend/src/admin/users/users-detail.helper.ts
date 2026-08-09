import { SupabaseClient } from '@supabase/supabase-js';
import { UserFeaturesService } from '../features/user-features.service';
import { UserDetail, UserStats } from './users.types';
import {
  getOverrideCountsForUsers,
  getPaywallCountsForUsers,
  getReportCountsForUsers,
  getBehaviorSignalsForUsers,
  getFirstReportTimestampsForUsers,
} from './users-batch-fetch.helper';

/** Earliest of first-value-event / first-report, minutes after signup. Null
 * when neither has happened yet. Duplicated from users-list.helper.ts —
 * both files are well under the size limit and this is 6 lines. */
function computeTimeToFirstValueMinutes(
  createdAt: string,
  firstValueAt: string | null | undefined,
  firstReportAt: string | null | undefined,
): number | null {
  const candidates = [firstValueAt, firstReportAt].filter(
    (t): t is string => !!t,
  );
  if (candidates.length === 0) return null;
  const earliest = candidates.reduce((a, b) => (a < b ? a : b));
  const minutes =
    (new Date(earliest).getTime() - new Date(createdAt).getTime()) / 60000;
  return minutes >= 0 ? Math.round(minutes) : 0;
}

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

  // Reuses the same batch helpers the list endpoint uses (with a one-element
  // userIds array) rather than duplicating slightly-different inline
  // queries — the previous version's paywall count here only read the
  // legacy paywall_events table, silently diverging from the list view's
  // (broader) count for the same user.
  const [
    overrideCounts,
    paywallCounts,
    reportCounts,
    behaviorSignals,
    firstReportTimestamps,
  ] = await Promise.all([
    getOverrideCountsForUsers(client, [userId]),
    getPaywallCountsForUsers(client, [userId]),
    getReportCountsForUsers(client, [userId]),
    getBehaviorSignalsForUsers(client, [userId]),
    getFirstReportTimestampsForUsers(client, [userId]),
  ]);
  const overrideCount = overrideCounts.get(userId) || 0;
  const paywallCount = paywallCounts.get(userId) || 0;
  const reportsGenerated = reportCounts.get(userId) || 0;
  const signals = behaviorSignals.get(userId);
  const firstReportAt = firstReportTimestamps.get(userId);

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
    reportsGenerated,
    scoreViews: signals?.scoreViews || 0,
    analyzerRuns: signals?.analyzerRuns || 0,
    timeToFirstValueMinutes: computeTimeToFirstValueMinutes(
      profile.created_at,
      signals?.firstValueAt,
      firstReportAt,
    ),
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
