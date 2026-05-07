import { Test } from '@nestjs/testing';
import { HookABService } from './hook-ab.service';
import { SupabaseService } from '../../supabase/supabase.service';

function buildSupabaseMock(rows: {
  runs?: Array<{ id: string }>;
  posts?: Array<{ id: string; hook_variant_id: 'A' | 'B' }>;
  metrics?: Array<{ platform_post_id: string; avg_retention_pct: number }>;
}) {
  return {
    getClient: () => ({
      from: (tbl: string) => {
        if (tbl === 'content_runs') {
          return {
            select: () => ({
              eq: async () => ({ data: rows.runs ?? [] }),
            }),
          };
        }
        if (tbl === 'platform_posts') {
          return {
            select: () => ({
              in: () => ({
                eq: () => ({
                  in: async () => ({ data: rows.posts ?? [] }),
                }),
              }),
            }),
          };
        }
        if (tbl === 'content_metrics') {
          return {
            select: () => ({
              eq: () => ({
                in: async () => ({ data: rows.metrics ?? [] }),
              }),
            }),
          };
        }
        return {};
      },
    }),
  };
}

describe('HookABService', () => {
  it('identifies winner when lift >= 30% and confidence >= 95%', async () => {
    const runs = [{ id: 'r1' }];
    const posts: Array<{ id: string; hook_variant_id: 'A' | 'B' }> = [];
    const metrics: Array<{ platform_post_id: string; avg_retention_pct: number }> =
      [];

    for (let i = 0; i < 60; i++) {
      posts.push({ id: `pa${i}`, hook_variant_id: 'A' });
      metrics.push({ platform_post_id: `pa${i}`, avg_retention_pct: 50 });
    }
    for (let i = 0; i < 60; i++) {
      posts.push({ id: `pb${i}`, hook_variant_id: 'B' });
      metrics.push({ platform_post_id: `pb${i}`, avg_retention_pct: 20 });
    }

    const module = await Test.createTestingModule({
      providers: [
        HookABService,
        {
          provide: SupabaseService,
          useValue: buildSupabaseMock({ runs, posts, metrics }),
        },
      ],
    }).compile();

    const svc = module.get(HookABService);
    const winner = await svc.determineWinner('grade_reveal');
    expect(winner).not.toBeNull();
    expect(winner?.winnerVariantId).toBe('A');
    expect(winner?.lift).toBeGreaterThanOrEqual(0.3);
    expect(winner?.confidence).toBeGreaterThanOrEqual(0.95);
  });

  it('returns null when lift is insufficient', async () => {
    const runs = [{ id: 'r1' }];
    const posts: Array<{ id: string; hook_variant_id: 'A' | 'B' }> = [];
    const metrics: Array<{ platform_post_id: string; avg_retention_pct: number }> =
      [];

    for (let i = 0; i < 60; i++) {
      posts.push({ id: `pa${i}`, hook_variant_id: 'A' });
      metrics.push({ platform_post_id: `pa${i}`, avg_retention_pct: 50 });
    }
    for (let i = 0; i < 60; i++) {
      posts.push({ id: `pb${i}`, hook_variant_id: 'B' });
      metrics.push({ platform_post_id: `pb${i}`, avg_retention_pct: 45 });
    }

    const module = await Test.createTestingModule({
      providers: [
        HookABService,
        {
          provide: SupabaseService,
          useValue: buildSupabaseMock({ runs, posts, metrics }),
        },
      ],
    }).compile();

    const svc = module.get(HookABService);
    const winner = await svc.determineWinner('grade_reveal');
    expect(winner).toBeNull();
  });

  it('returns null when sample size below 50 per variant', async () => {
    const runs = [{ id: 'r1' }];
    const posts: Array<{ id: string; hook_variant_id: 'A' | 'B' }> = [];
    const metrics: Array<{ platform_post_id: string; avg_retention_pct: number }> =
      [];

    for (let i = 0; i < 49; i++) {
      posts.push({ id: `pa${i}`, hook_variant_id: 'A' });
      metrics.push({ platform_post_id: `pa${i}`, avg_retention_pct: 50 });
    }
    for (let i = 0; i < 60; i++) {
      posts.push({ id: `pb${i}`, hook_variant_id: 'B' });
      metrics.push({ platform_post_id: `pb${i}`, avg_retention_pct: 20 });
    }

    const module = await Test.createTestingModule({
      providers: [
        HookABService,
        {
          provide: SupabaseService,
          useValue: buildSupabaseMock({ runs, posts, metrics }),
        },
      ],
    }).compile();

    const svc = module.get(HookABService);
    const winner = await svc.determineWinner('grade_reveal');
    expect(winner).toBeNull();
  });
});

