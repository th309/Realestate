import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { UserFeaturesService, UserOverride } from '../features/user-features.service';

export interface UserListItem {
  id: string;
  email: string;
  name: string;
  tier: string;
  tierStatus: string;
  createdAt: string;
  lastActive: string;
  // Trial
  trialActive: boolean;
  trialExpiresAt?: string;
  trialTier?: string;
  // Grandfathering
  grandfathered: boolean;
  grandfatheredType?: string;
  grandfatheredReason?: string;
  // Organization
  organizationId?: string;
  organizationName?: string;
  organizationRole?: string;
  // Stripe
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  // Beta
  isBetaTester: boolean;
  betaTesterId?: string;
  // Usage
  overrideCount: number;
  paywallHits: number;
  reportsGenerated: number;
  savedQueriesCount: number;
  watchlistCount: number;
  alertsCount: number;
}

export interface UserDetail extends UserListItem {
  overrides: UserOverride[];
  grandfatheringDetails?: {
    originalPrice?: number;
    originalTier?: string;
    effectiveFrom?: string;
    expiresAt?: string;
  };
}

export interface UserStats {
  totalUsers: number;
  withOverrides: number;
  activeTrials: number;
  grandfathered: number;
  betaTesters: number;
  inOrganizations: number;
  withStripe: number;
  byTier: Record<string, number>;
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly userFeatures: UserFeaturesService,
  ) {}

  async getUsers(options?: {
    search?: string;
    tier?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ users: UserListItem[]; total: number }> {
    const client = this.supabase.getClient();
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    // Query user_profiles with all relevant fields
    let query = client
      .from('user_profiles')
      .select(`
        id, email, full_name, subscription_tier, subscription_status,
        stripe_customer_id, stripe_subscription_id,
        organization_id, organization_role,
        reports_generated_this_month,
        created_at, updated_at, last_login_at
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (options?.search) {
      query = query.or(`email.ilike.%${options.search}%,full_name.ilike.%${options.search}%`);
    }

    if (options?.tier) {
      query = query.eq('subscription_tier', options.tier);
    }

    const { data: profiles, count, error } = await query;

    if (error) {
      this.logger.error('Failed to fetch user_profiles', error);
      return { users: [], total: 0 };
    }

    // Batch fetch related data for efficiency
    const userIds = (profiles || []).map(p => p.id);

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
      this.getTrialsForUsers(userIds),
      this.getOverrideCountsForUsers(userIds),
      this.getPaywallCountsForUsers(userIds),
      this.getGrandfathersForUsers(userIds),
      this.getBetaTestersForUsers(profiles?.map(p => p.email) || []),
      this.getOrganizationsForUsers([...new Set(profiles?.map(p => p.organization_id).filter(Boolean) || [])]),
      this.getSavedQueryCountsForUsers(userIds),
      this.getWatchlistCountsForUsers(userIds),
      this.getAlertCountsForUsers(userIds),
    ]);

    const users: UserListItem[] = (profiles || []).map(profile => {
      const trial = trials.get(profile.id);
      const grandfather = grandfathers.get(profile.id);
      const betaTester = betaTesters.get(profile.email?.toLowerCase());
      const org = profile.organization_id ? organizations.get(profile.organization_id) : null;

      return {
        id: profile.id,
        email: profile.email || '',
        name: profile.full_name || profile.email?.split('@')[0] || 'Unknown',
        tier: profile.subscription_tier || 'free',
        tierStatus: profile.subscription_status || 'active',
        createdAt: profile.created_at,
        lastActive: profile.last_login_at || profile.updated_at || profile.created_at,
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

    return { users, total: count || 0 };
  }

  // Batch helper methods
  private async getTrialsForUsers(userIds: string[]): Promise<Map<string, any>> {
    if (userIds.length === 0) return new Map();
    const client = this.supabase.getClient();
    const { data } = await client
      .from('user_trials')
      .select('user_id, tier, expires_at')
      .in('user_id', userIds)
      .is('converted_at', null)
      .is('cancelled_at', null)
      .gt('expires_at', new Date().toISOString());
    return new Map((data || []).map(t => [t.user_id, t]));
  }

  private async getOverrideCountsForUsers(userIds: string[]): Promise<Map<string, number>> {
    if (userIds.length === 0) return new Map();
    const client = this.supabase.getClient();
    const { data } = await client
      .from('user_feature_overrides')
      .select('user_id')
      .in('user_id', userIds);
    const counts = new Map<string, number>();
    (data || []).forEach(o => counts.set(o.user_id, (counts.get(o.user_id) || 0) + 1));
    return counts;
  }

  private async getPaywallCountsForUsers(userIds: string[]): Promise<Map<string, number>> {
    if (userIds.length === 0) return new Map();
    const client = this.supabase.getClient();
    const { data } = await client
      .from('paywall_events')
      .select('user_id')
      .in('user_id', userIds)
      .eq('event_type', 'view');
    const counts = new Map<string, number>();
    (data || []).forEach(e => counts.set(e.user_id, (counts.get(e.user_id) || 0) + 1));
    return counts;
  }

  private async getGrandfathersForUsers(userIds: string[]): Promise<Map<string, any>> {
    if (userIds.length === 0) return new Map();
    const client = this.supabase.getClient();
    const { data } = await client
      .from('user_grandfathering')
      .select('user_id, grandfathered_type, reason, original_price_monthly, original_tier_slug, effective_from, expires_at')
      .in('user_id', userIds)
      .eq('is_active', true);
    return new Map((data || []).map(g => [g.user_id, g]));
  }

  private async getBetaTestersForUsers(emails: string[]): Promise<Map<string, any>> {
    if (emails.length === 0) return new Map();
    const client = this.supabase.getClient();
    const lowerEmails = emails.map(e => e?.toLowerCase()).filter(Boolean);
    const { data } = await client
      .from('beta_testers')
      .select('id, email, name, is_active')
      .eq('is_active', true);
    // Match by email (case-insensitive)
    const map = new Map<string, any>();
    (data || []).forEach(bt => {
      if (bt.email && lowerEmails.includes(bt.email.toLowerCase())) {
        map.set(bt.email.toLowerCase(), bt);
      }
    });
    return map;
  }

  private async getOrganizationsForUsers(orgIds: string[]): Promise<Map<string, any>> {
    if (orgIds.length === 0) return new Map();
    const client = this.supabase.getClient();
    const { data } = await client
      .from('organizations')
      .select('id, name, slug')
      .in('id', orgIds);
    return new Map((data || []).map(o => [o.id, o]));
  }

  private async getSavedQueryCountsForUsers(userIds: string[]): Promise<Map<string, number>> {
    if (userIds.length === 0) return new Map();
    const client = this.supabase.getClient();
    const { data } = await client
      .from('analytics_saved_queries')
      .select('user_id')
      .in('user_id', userIds);
    const counts = new Map<string, number>();
    (data || []).forEach(q => counts.set(q.user_id, (counts.get(q.user_id) || 0) + 1));
    return counts;
  }

  private async getWatchlistCountsForUsers(userIds: string[]): Promise<Map<string, number>> {
    if (userIds.length === 0) return new Map();
    const client = this.supabase.getClient();
    const { data } = await client
      .from('analytics_watchlist')
      .select('user_id')
      .in('user_id', userIds);
    const counts = new Map<string, number>();
    (data || []).forEach(w => counts.set(w.user_id, (counts.get(w.user_id) || 0) + 1));
    return counts;
  }

  private async getAlertCountsForUsers(userIds: string[]): Promise<Map<string, number>> {
    if (userIds.length === 0) return new Map();
    const client = this.supabase.getClient();
    const { data } = await client
      .from('analytics_alerts')
      .select('user_id')
      .in('user_id', userIds)
      .eq('is_active', true);
    const counts = new Map<string, number>();
    (data || []).forEach(a => counts.set(a.user_id, (counts.get(a.user_id) || 0) + 1));
    return counts;
  }

  async getUserDetail(userId: string): Promise<UserDetail | null> {
    const client = this.supabase.getClient();

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
      this.userFeatures.getUserOverrides(userId),
      client.from('user_trials')
        .select('*')
        .eq('user_id', userId)
        .is('converted_at', null)
        .is('cancelled_at', null)
        .gt('expires_at', new Date().toISOString())
        .single()
        .then(r => r.data),
      client.from('user_grandfathering')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single()
        .then(r => r.data),
      profile.organization_id
        ? client.from('organizations').select('*').eq('id', profile.organization_id).single().then(r => r.data)
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
    const [overrideCount, paywallCount, savedQueries, watchlist, alerts] = await Promise.all([
      client.from('user_feature_overrides').select('*', { count: 'exact', head: true }).eq('user_id', userId).then(r => r.count || 0),
      client.from('paywall_events').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('event_type', 'view').then(r => r.count || 0),
      client.from('analytics_saved_queries').select('*', { count: 'exact', head: true }).eq('user_id', userId).then(r => r.count || 0),
      client.from('analytics_watchlist').select('*', { count: 'exact', head: true }).eq('user_id', userId).then(r => r.count || 0),
      client.from('analytics_alerts').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('is_active', true).then(r => r.count || 0),
    ]);

    return {
      id: profile.id,
      email: profile.email || '',
      name: profile.full_name || profile.email?.split('@')[0] || 'Unknown',
      tier: profile.subscription_tier || 'free',
      tierStatus: profile.subscription_status || 'active',
      createdAt: profile.created_at,
      lastActive: profile.last_login_at || profile.updated_at || profile.created_at,
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
      grandfatheringDetails: grandfather ? {
        originalPrice: grandfather.original_price_monthly,
        originalTier: grandfather.original_tier_slug,
        effectiveFrom: grandfather.effective_from,
        expiresAt: grandfather.expires_at,
      } : undefined,
    };
  }

  async getStats(): Promise<UserStats> {
    const client = this.supabase.getClient();

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
      client.from('user_trials')
        .select('*', { count: 'exact', head: true })
        .is('converted_at', null)
        .is('cancelled_at', null)
        .gt('expires_at', new Date().toISOString()),
      // Grandfathered users
      client.from('user_grandfathering').select('user_id').eq('is_active', true).limit(10000),
      // Beta testers
      client.from('beta_testers').select('*', { count: 'exact', head: true }).eq('is_active', true),
      // Users in organizations
      client.from('user_profiles').select('*', { count: 'exact', head: true }).not('organization_id', 'is', null),
      // Users with Stripe
      client.from('user_profiles').select('*', { count: 'exact', head: true }).not('stripe_customer_id', 'is', null),
      // Tier breakdown
      client.from('user_profiles').select('subscription_tier'),
    ]);

    // Calculate unique counts
    const uniqueOverrideUsers = new Set((overridesResult.data || []).map(u => u.user_id)).size;
    const uniqueGrandfathered = new Set((grandfatheredResult.data || []).map(u => u.user_id)).size;

    // Calculate tier breakdown
    const byTier: Record<string, number> = {};
    (tierBreakdown.data || []).forEach(u => {
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

  async addOverride(
    userId: string,
    featureSlug: string,
    options?: {
      reason?: string;
      expiresAt?: string;
      grantedBy?: string;
    }
  ): Promise<void> {
    await this.userFeatures.createOverride(userId, featureSlug, true, {
      reason: options?.reason,
      expiresAt: options?.expiresAt,
      grantedBy: options?.grantedBy,
    });
  }

  async removeOverride(userId: string, featureSlug: string): Promise<void> {
    await this.userFeatures.removeOverride(userId, featureSlug);
  }

  async updateUserTier(userId: string, tier: string): Promise<void> {
    const client = this.supabase.getClient();

    await client
      .from('user_profiles')
      .update({ subscription_tier: tier, updated_at: new Date().toISOString() })
      .eq('id', userId);

    this.logger.log(`Updated user ${userId} tier to ${tier}`);
  }
}
