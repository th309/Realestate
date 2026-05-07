import { Test } from '@nestjs/testing';
import { RevenueAttributionService } from './revenue-attribution.service';
import { SupabaseService } from '../../supabase/supabase.service';

function buildSupabaseMock(rows: {
  attributions?: Array<{ user_id: string; tier_at_signup: string }>;
  profiles?: Array<{
    id: string;
    subscription_tier: string;
    subscription_status: string;
  }>;
  tiers?: Array<{ slug: string; price_usd_monthly: number }>;
}) {
  return {
    getClient: () => ({
      from: (tbl: string) => {
        if (tbl === 'signup_attributions') {
          return {
            select: () => ({
              eq: async () => ({ data: rows.attributions ?? [] }),
            }),
          };
        }
        if (tbl === 'user_profiles') {
          return {
            select: () => ({
              in: async () => ({ data: rows.profiles ?? [] }),
            }),
          };
        }
        if (tbl === 'subscription_tiers') {
          return {
            select: async () => ({ data: rows.tiers ?? [] }),
          };
        }
        return {};
      },
    }),
  };
}

describe('RevenueAttributionService', () => {
  it('returns signups and sums MRR for active tiers', async () => {
    const module = await Test.createTestingModule({
      providers: [
        RevenueAttributionService,
        {
          provide: SupabaseService,
          useValue: buildSupabaseMock({
            attributions: [
              { user_id: 'u1', tier_at_signup: 'free' },
              { user_id: 'u2', tier_at_signup: 'free' },
              { user_id: 'u3', tier_at_signup: 'free' },
            ],
            profiles: [
              { id: 'u1', subscription_tier: 'pro', subscription_status: 'active' },
              {
                id: 'u2',
                subscription_tier: 'enterprise',
                subscription_status: 'trialing',
              },
              { id: 'u3', subscription_tier: 'free', subscription_status: 'none' },
            ],
            tiers: [
              { slug: 'pro', price_usd_monthly: 29 },
              { slug: 'enterprise', price_usd_monthly: 199 },
              { slug: 'free', price_usd_monthly: 0 },
            ],
          }),
        },
      ],
    }).compile();

    const svc = module.get(RevenueAttributionService);
    const result = await svc.getRevenueByRun('run-1');

    expect(result.runId).toBe('run-1');
    expect(result.signups).toBe(3);
    expect(result.conversions_to_pro).toBe(1);
    expect(result.conversions_to_enterprise).toBe(1);
    expect(result.total_mrr_contribution_usd).toBe(228);
  });

  it('returns zeros when no signups exist for run', async () => {
    const module = await Test.createTestingModule({
      providers: [
        RevenueAttributionService,
        {
          provide: SupabaseService,
          useValue: buildSupabaseMock({
            attributions: [],
            profiles: [],
            tiers: [],
          }),
        },
      ],
    }).compile();

    const svc = module.get(RevenueAttributionService);
    const result = await svc.getRevenueByRun('run-0');
    expect(result).toEqual({
      runId: 'run-0',
      signups: 0,
      conversions_to_pro: 0,
      conversions_to_enterprise: 0,
      total_mrr_contribution_usd: 0,
    });
  });
});

