import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';

export interface RunRevenue {
  runId: string;
  signups: number;
  conversions_to_pro: number;
  conversions_to_enterprise: number;
  total_mrr_contribution_usd: number;
}

@Injectable()
export class RevenueAttributionService {
  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Revenue attribution for a run uses existing schema discovered in Task 4.6:
   * - `signup_attributions` links run → user_id
   * - `user_profiles` holds current billing tier + Stripe ids
   *
   * Note: the codebase does not persist Stripe invoice amounts in Postgres, so
   * MRR is approximated from `subscription_tiers` configuration (monthly prices)
   * based on the user's current tier.
   */
  async getRevenueByRun(runId: string): Promise<RunRevenue> {
    const client = this.supabase.getClient();

    const { data: attributions } = await client
      .from('signup_attributions')
      .select('user_id, tier_at_signup')
      .eq('attributed_run_id', runId);

    const signups = attributions?.length ?? 0;
    if (!attributions || attributions.length === 0) {
      return {
        runId,
        signups: 0,
        conversions_to_pro: 0,
        conversions_to_enterprise: 0,
        total_mrr_contribution_usd: 0,
      };
    }

    const userIds = attributions.map((a: any) => a.user_id).filter(Boolean);
    const { data: profiles } = await client
      .from('user_profiles')
      .select('id, subscription_tier, subscription_status')
      .in('id', userIds);

    const profilesById = new Map<string, any>();
    for (const p of profiles ?? []) profilesById.set(p.id, p);

    // Load tier pricing config once for MRR approximation.
    const { data: tiers } = await client
      .from('subscription_tiers')
      .select('slug, price_usd_monthly');
    const mrrByTier = new Map<string, number>();
    for (const t of tiers ?? []) {
      const v = Number((t as any).price_usd_monthly ?? 0);
      if ((t as any).slug && Number.isFinite(v)) {
        mrrByTier.set((t as any).slug, v);
      }
    }

    let pro = 0;
    let enterprise = 0;
    let mrr = 0;

    for (const a of attributions ?? []) {
      const p = profilesById.get(a.user_id);
      if (!p) continue;
      if (p.subscription_status !== 'active' && p.subscription_status !== 'trialing')
        continue;

      if (p.subscription_tier === 'pro') pro += 1;
      if (p.subscription_tier === 'enterprise') enterprise += 1;

      const price = mrrByTier.get(p.subscription_tier);
      if (price) mrr += price;
    }

    return {
      runId,
      signups,
      conversions_to_pro: pro,
      conversions_to_enterprise: enterprise,
      total_mrr_contribution_usd: mrr,
    };
  }
}

