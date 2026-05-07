import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { DashboardResponseDto } from './dto/dashboard-response.dto';
import {
  getAssetSignedUrl as getAssetSignedUrlFn,
  SignedAssetKind,
} from './asset-signing';
import { AutoIdeationService } from './auto-ideation/auto-ideation.service';
import { CostCapService } from './auto-ideation/cost-cap.service';

/**
 * Read-only queries that power the admin UI: dashboard rollups, run
 * detail (with assets + events + gates + posts), the review queue, and
 * signed asset URLs for the in-browser video/audio preview.
 *
 * Mutating operations live in `content-runs.service.ts` (creates) and
 * `run-actions.service.ts` (state transitions).
 */
@Injectable()
export class ContentPipelineQueriesService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly autoIdeation: AutoIdeationService,
    // Keep injected so the module can enforce availability, even though
    // this class reads the underlying table directly for dashboard status.
    // (Also useful for future spend recording from handlers.)
    private readonly costCap: CostCapService,
  ) {}

  /**
   * For each format, return a signed URL to the most recent successful
   * run's video_master so the /new wizard's format picker can show what
   * the format ACTUALLY produces today (instead of the static MP4
   * baked into /public/format-previews/ at P1 time).
   *
   * Picks the newest run in published / published_partial /
   * ready_for_review state per format. Returns null for any format that
   * hasn't produced a video yet — caller falls back to the static MP4.
   *
   * Caps at 200 most-recent runs scanned to avoid hammering the DB once
   * the run table grows.
   */
  async getFormatSampleVideos(): Promise<
    Record<
      string,
      { runId: string; marketName: string; videoUrl: string | null }
    >
  > {
    const client = this.supabase.getClient();
    const { data: runs } = await client
      .from('content_runs')
      .select('id, format, market_query, status, created_at')
      .in('status', ['published', 'published_partial', 'ready_for_review'])
      .order('created_at', { ascending: false })
      .limit(200);
    if (!runs || runs.length === 0) return {};

    const byFormat = new Map<
      string,
      { id: string; format: string; market_query: string }
    >();
    for (const r of runs) {
      const fmt = r.format as string;
      if (!byFormat.has(fmt)) {
        byFormat.set(fmt, {
          id: r.id as string,
          format: fmt,
          market_query: (r.market_query as string) ?? 'Unknown',
        });
      }
    }

    const result: Record<
      string,
      { runId: string; marketName: string; videoUrl: string | null }
    > = {};
    await Promise.all(
      Array.from(byFormat.entries()).map(async ([format, run]) => {
        const signed = await getAssetSignedUrlFn(
          client,
          run.id,
          'video_master',
        );
        result[format] = {
          runId: run.id,
          marketName: run.market_query,
          videoUrl: signed?.url ?? null,
        };
      }),
    );
    return result;
  }

  async getDashboard(
    opts: { batchId?: string } = {},
  ): Promise<DashboardResponseDto> {
    const client = this.supabase.getClient();

    // When filtering by batchId, return ALL runs in the batch (no recency
    // cap) and skip the global rollup counts which are meaningless for a
    // single batch view.
    if (opts.batchId) {
      const { data: batchRuns } = await client
        .from('content_runs')
        .select('id, format, status, market_query, created_at, status_reason')
        .eq('batch_id', opts.batchId)
        .order('created_at', { ascending: false });

      const runIds = (batchRuns ?? []).map((r) => r.id as string);
      const videoRunIds = new Set<string>();
      if (runIds.length > 0) {
        const { data: videos } = await client
          .from('content_assets')
          .select('run_id')
          .eq('kind', 'video_master')
          .in('run_id', runIds);
        for (const v of videos ?? []) videoRunIds.add(v.run_id as string);
      }

      return {
        thisWeek: { published: 0, inReview: 0, signups: 0, revenueUsd: 0 },
        recentRuns: (batchRuns ?? []).map((r) => ({
          ...r,
          has_video: videoRunIds.has(r.id as string),
        })),
        reviewQueueCount: 0,
      };
    }

    const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

    const { count: published } = await client
      .from('content_runs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'published')
      .gte('created_at', weekAgo);

    // Matches getReviewQueue(): every run in ready_for_review (any format,
    // with or without video_master) needs operator attention.
    const { count: inReviewCount } = await client
      .from('content_runs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'ready_for_review');
    const inReview = inReviewCount ?? 0;

    const { count: signups } = await client
      .from('signup_attributions')
      .select('id', { count: 'exact', head: true })
      .gte('signup_at', weekAgo);

    const { data: recent } = await client
      .from('content_runs')
      .select('id, format, status, market_query, created_at, status_reason')
      .order('created_at', { ascending: false })
      .limit(12);

    const runIds = (recent ?? []).map((r) => r.id);
    const videoRunIds = new Set<string>();
    if (runIds.length > 0) {
      const { data: videos } = await client
        .from('content_assets')
        .select('run_id')
        .eq('kind', 'video_master')
        .in('run_id', runIds);
      for (const v of videos ?? []) videoRunIds.add(v.run_id as string);
    }

    return {
      thisWeek: {
        published: published ?? 0,
        inReview: inReview ?? 0,
        signups: signups ?? 0,
        revenueUsd: 0,
      },
      recentRuns: (recent ?? []).map((r) => ({
        ...r,
        has_video: videoRunIds.has(r.id as string),
      })),
      reviewQueueCount: inReview ?? 0,
      upcomingAutoRuns: await this.autoIdeation.previewUpcoming(),
      costCapStatus: await this.getCostCapStatus(),
    };
  }

  private async getCostCapStatus(): Promise<{
    breached: boolean;
    usdSpent: number;
    usdCap: number;
  }> {
    const client = this.supabase.getClient();
    const today = new Date().toISOString().slice(0, 10);
    const envCap = Number(process.env.CONTENT_PIPELINE_DAILY_USD_MAX);
    const fallbackCap = Number.isFinite(envCap) ? envCap : 50;

    const { data, error } = await client
      .from('cost_cap_daily')
      .select('*')
      .eq('date', today)
      .maybeSingle();
    if (error) throw error;

    const usdCap = Number(data?.usd_cap ?? fallbackCap);
    const usdSpent = Number(data?.usd_spent ?? 0);
    return { breached: usdSpent >= usdCap, usdSpent, usdCap };
  }

  async getRunDetail(runId: string) {
    const client = this.supabase.getClient();
    const [run, assets, events, gates, posts] = await Promise.all([
      client.from('content_runs').select('*').eq('id', runId).single(),
      client
        .from('content_assets')
        .select('*')
        .eq('run_id', runId)
        .order('created_at', { ascending: true }),
      client
        .from('content_run_events')
        .select('*')
        .eq('run_id', runId)
        .order('created_at', { ascending: true }),
      client
        .from('content_run_gates')
        .select('*')
        .eq('run_id', runId)
        .order('created_at', { ascending: true }),
      client.from('platform_posts').select('*').eq('run_id', runId),
    ]);
    if (run.error || !run.data) throw new Error('run not found');
    return {
      run: run.data,
      assets: assets.data ?? [],
      events: events.data ?? [],
      gates: gates.data ?? [],
      posts: posts.data ?? [],
    };
  }

  getAssetSignedUrl(
    runId: string,
    kind: SignedAssetKind,
  ): Promise<{ url: string; kind: string } | null> {
    return getAssetSignedUrlFn(this.supabase.getClient(), runId, kind);
  }

  async getReviewQueue() {
    const client = this.supabase.getClient();
    const { data: runs } = await client
      .from('content_runs')
      .select('*')
      .eq('status', 'ready_for_review')
      .order('created_at', { ascending: true })
      .limit(50);

    if ((runs ?? []).length === 0) return { items: [], cursor: null };

    // Include all ready_for_review runs: post-render (has video) and
    // pre-render (e.g. gate_a_drift after verify_data) so operators can fix
    // script and re-verify from the same queue UI. ReviewCard already handles
    // a missing video_master.
    return { items: runs ?? [], cursor: null };
  }
}
