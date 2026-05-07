import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { RevenueAttributionService } from './revenue-attribution.service';

export interface PerformanceHeroCard {
  sinceDays: number;
  publishedRuns: number;
  avgViews7d: number | null;
  avgSignups7d: number | null;
  avgMrr7dUsd: number | null;
}

export interface FormatConversionRow {
  format: string;
  runs: number;
  posts: number;
  views7d: number;
  signups7d: number;
  mrr7dUsd: number;
  signupsPer1kViews: number | null;
}

export interface HookPatternRow {
  format: string;
  winnerVariantId: 'A' | 'B';
  confidence: number;
  lift: number;
  aMeanRetention: number;
  bMeanRetention: number;
  aSamples: number;
  bSamples: number;
  lastPromotedAt: string | null;
}

export interface PerformanceRunRow {
  id: string;
  created_at: string;
  format: string;
  status: string;
  market_query: string;
  views_7d: number;
  signups_7d: number;
  mrr_7d_usd: number;
  platforms: string[];
}

@Injectable()
export class PerformanceService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly revenue: RevenueAttributionService,
  ) {}

  async getHeroCard(sinceDays = 30): Promise<PerformanceHeroCard> {
    const client = this.supabase.getClient();
    const sinceIso = new Date(
      Date.now() - sinceDays * 24 * 3600 * 1000,
    ).toISOString();

    const { data: runs } = await client
      .from('content_runs')
      .select('id, status, created_at')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(500);

    const publishedRuns = (runs ?? []).filter((r) =>
      ['published', 'published_partial'].includes(String(r.status)),
    ).length;

    const runIds = (runs ?? []).map((r) => String(r.id));
    if (runIds.length === 0) {
      return {
        sinceDays,
        publishedRuns: 0,
        avgViews7d: null,
        avgSignups7d: null,
        avgMrr7dUsd: null,
      };
    }

    const [viewsByRun, signupsByRun, mrrByRun] = await Promise.all([
      this.getViewsByRun(runIds, '7d'),
      this.getSignupsByRun(runIds, 7),
      this.getMrrByRun(runIds),
    ]);

    const avg = (xs: number[]) =>
      xs.length === 0 ? null : xs.reduce((a, b) => a + b, 0) / xs.length;

    return {
      sinceDays,
      publishedRuns,
      avgViews7d: avg(Object.values(viewsByRun)),
      avgSignups7d: avg(Object.values(signupsByRun)),
      avgMrr7dUsd: avg(Object.values(mrrByRun)),
    };
  }

  async getFormatConversion(sinceDays = 30): Promise<FormatConversionRow[]> {
    const client = this.supabase.getClient();
    const sinceIso = new Date(
      Date.now() - sinceDays * 24 * 3600 * 1000,
    ).toISOString();

    const { data: runs } = await client
      .from('content_runs')
      .select('id, format, created_at')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(1000);

    const runIds = (runs ?? []).map((r) => String(r.id));
    const formatByRun = new Map<string, string>();
    for (const r of runs ?? []) formatByRun.set(String(r.id), String(r.format));

    const [viewsByRun, signupsByRun, mrrByRun, postsByRun] =
      await Promise.all([
        this.getViewsByRun(runIds, '7d'),
        this.getSignupsByRun(runIds, 7),
        this.getMrrByRun(runIds),
        this.getPostsByRun(runIds),
      ]);

    const byFormat = new Map<string, FormatConversionRow>();
    for (const runId of runIds) {
      const format = formatByRun.get(runId) ?? 'unknown';
      const row = byFormat.get(format) ?? {
        format,
        runs: 0,
        posts: 0,
        views7d: 0,
        signups7d: 0,
        mrr7dUsd: 0,
        signupsPer1kViews: null,
      };
      row.runs += 1;
      row.posts += postsByRun[runId] ?? 0;
      row.views7d += viewsByRun[runId] ?? 0;
      row.signups7d += signupsByRun[runId] ?? 0;
      row.mrr7dUsd += mrrByRun[runId] ?? 0;
      byFormat.set(format, row);
    }

    const result = Array.from(byFormat.values()).map((r) => ({
      ...r,
      signupsPer1kViews:
        r.views7d > 0 ? (r.signups7d / r.views7d) * 1000 : null,
    }));

    result.sort((a, b) => b.mrr7dUsd - a.mrr7dUsd);
    return result;
  }

  async getHookPatterns(): Promise<HookPatternRow[]> {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('hook_archetypes')
      .select(
        'format, last_winner_variant, last_winner_confidence, last_winner_lift, last_promoted_at',
      )
      .order('format');
    if (error) throw error;

    return (data ?? [])
      .filter((r) => r.last_winner_variant)
      .map((r) => ({
        format: String(r.format),
        winnerVariantId: (String(r.last_winner_variant) as 'A' | 'B') ?? 'A',
        confidence: Number(r.last_winner_confidence ?? 0),
        lift: Number(r.last_winner_lift ?? 0),
        aMeanRetention: 0,
        bMeanRetention: 0,
        aSamples: 0,
        bSamples: 0,
        lastPromotedAt: (r.last_promoted_at as string | null) ?? null,
      }));
  }

  async getRunsTable(opts: {
    sinceDays?: number;
    format?: string;
    sort?: 'created_at' | 'views_7d' | 'signups_7d' | 'mrr_7d';
    dir?: 'asc' | 'desc';
    limit?: number;
  }): Promise<PerformanceRunRow[]> {
    const sinceDays = opts.sinceDays ?? 30;
    const limit = opts.limit ?? 50;
    const client = this.supabase.getClient();
    const sinceIso = new Date(
      Date.now() - sinceDays * 24 * 3600 * 1000,
    ).toISOString();

    let q = client
      .from('content_runs')
      .select('id, created_at, format, status, market_query')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (opts.format) q = q.eq('format', opts.format);

    const { data: runs, error } = await q;
    if (error) throw error;
    const runIds = (runs ?? []).map((r) => String(r.id));

    const [viewsByRun, signupsByRun, mrrByRun, platformsByRun] =
      await Promise.all([
        this.getViewsByRun(runIds, '7d'),
        this.getSignupsByRun(runIds, 7),
        this.getMrrByRun(runIds),
        this.getPlatformsByRun(runIds),
      ]);

    const rows: PerformanceRunRow[] = (runs ?? []).map((r) => ({
      id: String(r.id),
      created_at: String(r.created_at),
      format: String(r.format),
      status: String(r.status),
      market_query: String(r.market_query ?? ''),
      views_7d: viewsByRun[String(r.id)] ?? 0,
      signups_7d: signupsByRun[String(r.id)] ?? 0,
      mrr_7d_usd: mrrByRun[String(r.id)] ?? 0,
      platforms: platformsByRun[String(r.id)] ?? [],
    }));

    const dir = opts.dir ?? 'desc';
    const sort = opts.sort ?? 'created_at';
    const mult = dir === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      if (sort === 'created_at') {
        return mult * (a.created_at.localeCompare(b.created_at) * -1);
      }
      if (sort === 'views_7d') return mult * (a.views_7d - b.views_7d);
      if (sort === 'signups_7d') return mult * (a.signups_7d - b.signups_7d);
      return mult * (a.mrr_7d_usd - b.mrr_7d_usd);
    });

    return rows;
  }

  private async getViewsByRun(
    runIds: string[],
    window: '7d' | '30d',
  ): Promise<Record<string, number>> {
    if (runIds.length === 0) return {};
    const client = this.supabase.getClient();
    const { data } = await client
      .from('content_metrics')
      .select('run_id, views')
      .in('run_id', runIds)
      .eq('window', window);
    const out: Record<string, number> = {};
    for (const row of data ?? []) {
      const runId = String(row.run_id);
      out[runId] = (out[runId] ?? 0) + Number(row.views ?? 0);
    }
    return out;
  }

  private async getSignupsByRun(
    runIds: string[],
    windowDays: number,
  ): Promise<Record<string, number>> {
    if (runIds.length === 0) return {};
    const client = this.supabase.getClient();
    const sinceIso = new Date(
      Date.now() - windowDays * 24 * 3600 * 1000,
    ).toISOString();
    const { data } = await client
      .from('signup_attributions')
      .select('content_run_id')
      .in('content_run_id', runIds)
      .gte('signup_at', sinceIso);
    const out: Record<string, number> = {};
    for (const row of data ?? []) {
      const runId = String(row.content_run_id);
      out[runId] = (out[runId] ?? 0) + 1;
    }
    return out;
  }

  private async getMrrByRun(runIds: string[]): Promise<Record<string, number>> {
    if (runIds.length === 0) return {};
    const out: Record<string, number> = {};
    await Promise.all(
      runIds.map(async (runId) => {
        try {
          const rev = await this.revenue.getRevenueByRun(runId);
          out[runId] = Number(rev.total_mrr_contribution_usd ?? 0);
        } catch {
          out[runId] = 0;
        }
      }),
    );
    return out;
  }

  private async getPostsByRun(runIds: string[]): Promise<Record<string, number>> {
    if (runIds.length === 0) return {};
    const client = this.supabase.getClient();
    const { data } = await client
      .from('platform_posts')
      .select('run_id')
      .in('run_id', runIds);
    const out: Record<string, number> = {};
    for (const row of data ?? []) {
      const runId = String(row.run_id);
      out[runId] = (out[runId] ?? 0) + 1;
    }
    return out;
  }

  private async getPlatformsByRun(
    runIds: string[],
  ): Promise<Record<string, string[]>> {
    if (runIds.length === 0) return {};
    const client = this.supabase.getClient();
    const { data } = await client
      .from('platform_posts')
      .select('run_id, platform')
      .in('run_id', runIds);
    const out: Record<string, string[]> = {};
    for (const row of data ?? []) {
      const runId = String(row.run_id);
      const platform = String(row.platform ?? '');
      if (!platform) continue;
      out[runId] = out[runId] ?? [];
      if (!out[runId].includes(platform)) out[runId].push(platform);
    }
    return out;
  }
}

