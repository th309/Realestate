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
 *  2. admin_users — an admin/super_admin is ALWAYS admin tier, authoritative
 *     over any trial/subscription/org. (admin is the highest TIER_ORDER rank.)
 *  3. Active trial
 *  4. Personal subscription (user_profiles)
 *  5. Org-tier inheritance — max(personal, org) where org has active billing
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

    // ── 0. Admin override (authoritative, highest priority) ──────────
    // An admin/super_admin is ALWAYS the admin tier, regardless of any
    // trial, subscription, or org membership. Resolved FIRST so an
    // auto-granted trial (reverse-trial-on-signup) can never mask admin
    // status. `.maybeSingle()` so "no admin row" is data:null (not an error);
    // a genuine lookup error is logged and we fall through to normal
    // resolution rather than silently downgrading.
    const { data: adminRow, error: adminError } = await client
      .from('admin_users')
      .select('role')
      .eq('id', userId)
      .maybeSingle();

    if (adminError) {
      this.logger.error(
        `[Entitlements] admin_users lookup failed for ${userId.substring(0, 8)}...: ${adminError.message}`,
      );
    } else if (
      adminRow &&
      (adminRow.role === 'admin' || adminRow.role === 'super_admin')
    ) {
      this.logger.debug(
        `[Entitlements] User ${userId.substring(0, 8)}... is ${adminRow.role} — granting admin tier`,
      );
      return {
        tier: 'admin',
        trial: null,
        baselineTierWithoutTrial: null,
        needsPerUserQuery: false,
      };
    }

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

    return {
      tier,
      trial: null,
      baselineTierWithoutTrial: null,
      needsPerUserQuery: false,
    };
  }
}
