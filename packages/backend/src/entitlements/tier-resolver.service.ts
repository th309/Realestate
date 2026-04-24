import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { EntitlementsResponse } from './entitlements.service';

export interface ResolvedTier {
  tier: string;
  trial: EntitlementsResponse['trial'];
  baselineTierWithoutTrial: string | null;
  needsPerUserQuery: boolean;
}

/**
 * Resolves the effective entitlement tier for a user.
 *
 * Resolution order (highest wins):
 *  1. tierOverride (caller-supplied, skips all DB lookups)
 *  2. Active trial
 *  3. Personal subscription (user_profiles)
 *  4. Org-tier inheritance — max(personal, org) where org has active billing
 *  5. admin_users fallback (only when still 'free' after the above)
 */
@Injectable()
export class TierResolverService {
  private readonly logger = new Logger(TierResolverService.name);

  static readonly TIER_ORDER: Record<string, number> = {
    free: 0,
    pro: 1,
    enterprise: 2,
    admin: 3,
  };

  static tierRank(t: string | null | undefined): number {
    return t ? (TierResolverService.TIER_ORDER[t] ?? 0) : 0;
  }

  constructor(private readonly supabase: SupabaseService) {}

  async resolve(
    userId: string | null,
    tierOverride: string | null,
  ): Promise<ResolvedTier> {
    if (!userId || tierOverride) {
      return {
        tier: tierOverride || 'free',
        trial: null,
        baselineTierWithoutTrial: null,
        needsPerUserQuery: false,
      };
    }

    const client = this.supabase.getClient();

    // ── 1. Active trial ──────────────────────────────────────────────
    const { data: trialData } = await client
      .from('user_trials')
      .select('tier, expires_at')
      .eq('user_id', userId)
      .is('converted_at', null)
      .is('cancelled_at', null)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (trialData) {
      const daysRemaining = Math.ceil(
        (new Date(trialData.expires_at).getTime() - Date.now()) /
          (1000 * 60 * 60 * 24),
      );

      // Determine baseline (what tier WITHOUT the trial) for emitter logic.
      const { data: profile } = await client
        .from('user_profiles')
        .select('subscription_tier, subscription_status')
        .eq('id', userId)
        .single();

      const paidTier =
        profile?.subscription_tier &&
        profile.subscription_tier !== 'free' &&
        (profile.subscription_tier === 'admin' ||
          profile.subscription_status === 'active' ||
          !profile.subscription_status)
          ? profile.subscription_tier
          : 'free';

      return {
        tier: trialData.tier,
        trial: { active: true, daysRemaining, tier: trialData.tier },
        baselineTierWithoutTrial: paidTier,
        needsPerUserQuery: true,
      };
    }

    // ── 2. Personal subscription ─────────────────────────────────────
    const { data: profile } = await client
      .from('user_profiles')
      .select('subscription_tier, subscription_status')
      .eq('id', userId)
      .single();

    let tier = 'free';

    if (profile?.subscription_tier && profile.subscription_tier !== 'free') {
      const isAdmin = profile.subscription_tier === 'admin';
      if (
        isAdmin ||
        profile.subscription_status === 'active' ||
        !profile.subscription_status
      ) {
        tier = profile.subscription_tier;
      }
    }

    // ── 3. Org-tier inheritance (P2-Y) ───────────────────────────────
    const { data: orgMembership } = await client
      .from('organization_members')
      .select('organizations!inner(tier, billing_status)')
      .eq('user_id', userId)
      .eq('status', 'active')
      .eq('organizations.billing_status', 'active')
      .maybeSingle();

    const orgTier = (orgMembership?.organizations as any)?.tier ?? null;

    if (
      orgTier &&
      TierResolverService.tierRank(orgTier) > TierResolverService.tierRank(tier)
    ) {
      tier = orgTier;
    }

    // ── 4. admin_users fallback ──────────────────────────────────────
    if (tier === 'free') {
      const { data: adminRow } = await client
        .from('admin_users')
        .select('role')
        .eq('id', userId)
        .single();

      if (
        adminRow &&
        (adminRow.role === 'admin' || adminRow.role === 'super_admin')
      ) {
        tier = 'admin';
        this.logger.debug(
          `[Entitlements] User ${userId.substring(0, 8)}... is ${adminRow.role} — granting admin tier`,
        );
      }
    }

    return {
      tier,
      trial: null,
      baselineTierWithoutTrial: null,
      needsPerUserQuery: false,
    };
  }
}
