import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { DashboardResponseDto } from './dto/dashboard-response.dto';
import { CreateRunDto } from './dto/create-run.dto';
import { RunOrchestratorService } from './orchestrator/run-orchestrator.service';
import { QueueService } from './orchestrator/queue.service';
import { ContentDataService } from './data/content-data.service';
import {
  getAssetSignedUrl as getAssetSignedUrlFn,
  SignedAssetKind,
} from './asset-signing';
import { LeadMagnetKind } from './drivers/lead-magnet-renderer.interface';

@Injectable()
export class ContentPipelineService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly orchestrator: RunOrchestratorService,
    private readonly queueService: QueueService,
    private readonly contentData: ContentDataService,
  ) {}

  async createRun(
    dto: CreateRunDto,
  ): Promise<{ id: string; idempotencyKey: string; status: string }> {
    const client = this.supabase.getClient();
    const existing = await client
      .from('content_runs')
      .select('id, status')
      .eq('idempotency_key', dto.idempotencyKey)
      .maybeSingle();
    if (existing.data) {
      return {
        id: existing.data.id,
        idempotencyKey: dto.idempotencyKey,
        status: existing.data.status,
      };
    }

    const { data: template } = await client
      .from('format_templates')
      .select('*')
      .eq('format', dto.format)
      .single();
    if (!template) throw new Error(`format ${dto.format} not configured`);
    if (!template.enabled) throw new Error(`format ${dto.format} is disabled`);

    const { data: inserted, error } = await client
      .from('content_runs')
      .insert({
        format: dto.format,
        audience: template.audience,
        market_query: dto.marketQuery,
        approval_mode: dto.approvalMode ?? template.default_approval_mode,
        tts_provider: template.default_tts_provider,
        tts_voice_id: template.default_tts_voice_id,
        selected_platforms: dto.selectedPlatforms ?? template.default_platforms,
        idempotency_key: dto.idempotencyKey,
        status: 'queued',
        triggered_by: 'manual',
      })
      .select('id, status')
      .single();
    if (error) throw error;

    await this.queueService.send('orchestrator', {
      runId: inserted.id,
      status: 'fetching_data',
    });
    await this.orchestrator.transitionTo(inserted.id, 'fetching_data', {
      enqueueNext: false,
    });

    return {
      id: inserted.id,
      idempotencyKey: dto.idempotencyKey,
      status: inserted.status,
    };
  }

  async resolveMarket(query: string) {
    return this.contentData.resolveMarket(query);
  }

  /**
   * Admin-only: enqueue a `render-pdf` job to smoke-test lead-magnet
   * delivery (render + storage + email attachment) without requiring a
   * public signup. Recipient defaults to the calling admin's own inbox
   * so we never accidentally email a real customer while verifying the
   * pipeline.
   */
  async triggerTestMagnet(
    adminUserId: string,
    dto: {
      marketQuery: string;
      magnetKind?: LeadMagnetKind;
      recipientEmailOverride?: string;
    },
  ): Promise<{
    jobId: string | null;
    match: { geography: string; id: string; canonical_name: string };
    recipientEmail: string;
  }> {
    const client = this.supabase.getClient();

    const { data: userRes, error: userErr } =
      await client.auth.admin.getUserById(adminUserId);
    if (userErr || !userRes?.user) {
      throw new Error(`admin user ${adminUserId} not found in auth.users`);
    }
    const authUser = userRes.user;
    const recipientEmail =
      dto.recipientEmailOverride ?? authUser.email ?? undefined;
    if (!recipientEmail) {
      throw new Error('no recipient email — admin user has no email on file');
    }
    const recipientName =
      (authUser.user_metadata?.full_name as string | undefined) ??
      (authUser.user_metadata?.name as string | undefined) ??
      recipientEmail.split('@')[0];

    const matches = await this.contentData.resolveMarket(dto.marketQuery);
    if (matches.length === 0) {
      throw new Error(`no geography match for "${dto.marketQuery}"`);
    }
    const match = matches[0];

    const job = {
      userId: adminUserId,
      userEmail: recipientEmail,
      userName: recipientName,
      magnetKind: dto.magnetKind ?? 'market_snapshot_pdf',
      resolvedGeo: {
        geography: match.geography,
        id: match.id,
        canonical_name: match.canonical_name,
      },
    };

    const jobId = await this.queueService.send('render-pdf', job);
    return {
      jobId,
      match: job.resolvedGeo,
      recipientEmail,
    };
  }

  async getDashboard(): Promise<DashboardResponseDto> {
    const client = this.supabase.getClient();
    const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

    const { count: published } = await client
      .from('content_runs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'published')
      .gte('created_at', weekAgo);

    // "In Review" counts only runs with a rendered video — the review queue
    // is for publish-approve, and pre-render gate failures (gate_a_drift /
    // gate_b_voice) shouldn't be counted here since they can't be published
    // until re-scripted.
    const { data: reviewRuns } = await client
      .from('content_runs')
      .select('id')
      .eq('status', 'ready_for_review');
    let inReview = 0;
    if (reviewRuns && reviewRuns.length > 0) {
      const reviewIds = reviewRuns.map((r) => r.id as string);
      const { data: reviewVideos } = await client
        .from('content_assets')
        .select('run_id')
        .eq('kind', 'video_master')
        .in('run_id', reviewIds);
      inReview = new Set((reviewVideos ?? []).map((v) => v.run_id as string))
        .size;
    }

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
    };
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

  async approveRun(runId: string): Promise<void> {
    await this.orchestrator.transitionTo(runId, 'publishing', {
      enqueueNext: true,
    });
  }

  async rejectRun(runId: string, reason: string): Promise<void> {
    await this.orchestrator.transitionTo(runId, 'rejected', {
      reason,
      enqueueNext: false,
    });
  }

  // Abort an in-flight run. If a handler is currently executing, it will
  // finish its work and then fail to advance because `cancelled` is terminal
  // — no further steps fire. Assets already written to storage are retained
  // so operators can inspect what the run produced before cancellation.
  async cancelRun(runId: string, reason?: string): Promise<void> {
    await this.orchestrator.transitionTo(runId, 'cancelled', {
      reason: reason ?? 'user_cancelled',
      enqueueNext: false,
    });
  }

  async editScript(
    runId: string,
    variantId: 'A' | 'B',
    newFullText: string,
  ): Promise<void> {
    const client = this.supabase.getClient();
    const { data: scriptAsset, error } = await client
      .from('content_assets')
      .select('metadata')
      .eq('run_id', runId)
      .eq('kind', 'script')
      .single();
    if (error || !scriptAsset) throw new Error('script asset not found');

    const existingMetadata = (scriptAsset.metadata ?? {}) as Record<
      string,
      unknown
    >;
    const scripts = (existingMetadata.scripts ?? []) as Array<{
      variantId: string;
      fullText: string;
      [key: string]: unknown;
    }>;
    const updated = scripts.map((s) =>
      s.variantId === variantId ? { ...s, fullText: newFullText } : s,
    );

    await client
      .from('content_assets')
      .update({ metadata: { ...existingMetadata, scripts: updated } })
      .eq('run_id', runId)
      .eq('kind', 'script');

    await this.orchestrator.transitionTo(runId, 'linting_voice', {
      reason: 'operator_edit',
      enqueueNext: true,
    });
  }

  async retryRun(runId: string): Promise<void> {
    await this.orchestrator.retryRun(runId);
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

    const ids = (runs ?? []).map((r) => r.id as string);
    if (ids.length === 0) return { items: [], cursor: null };

    // Only surface runs that have a rendered video — pre-render gate failures
    // stay in the failed/failed-reason views; the review queue is for
    // human-approve-before-publish, which requires a playable artifact.
    const { data: videos } = await client
      .from('content_assets')
      .select('run_id')
      .eq('kind', 'video_master')
      .in('run_id', ids);
    const renderedIds = new Set((videos ?? []).map((v) => v.run_id as string));
    const filtered = (runs ?? []).filter((r) =>
      renderedIds.has(r.id as string),
    );
    return { items: filtered, cursor: null };
  }
}
