import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { DashboardResponseDto } from './dto/dashboard-response.dto';
import { CreateRunDto } from './dto/create-run.dto';
import { RunOrchestratorService } from './orchestrator/run-orchestrator.service';
import { QueueService } from './orchestrator/queue.service';
import { ContentDataService } from './data/content-data.service';

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

  async getDashboard(): Promise<DashboardResponseDto> {
    const client = this.supabase.getClient();
    const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

    const { count: published } = await client
      .from('content_runs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'published')
      .gte('created_at', weekAgo);

    const { count: inReview } = await client
      .from('content_runs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'ready_for_review');

    const { count: signups } = await client
      .from('signup_attributions')
      .select('id', { count: 'exact', head: true })
      .gte('signup_at', weekAgo);

    const { data: recent } = await client
      .from('content_runs')
      .select('id, format, status, market_query, created_at')
      .order('created_at', { ascending: false })
      .limit(12);

    return {
      thisWeek: {
        published: published ?? 0,
        inReview: inReview ?? 0,
        signups: signups ?? 0,
        revenueUsd: 0,
      },
      recentRuns: recent ?? [],
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

  async getReviewQueue() {
    const client = this.supabase.getClient();
    const { data: runs } = await client
      .from('content_runs')
      .select('*')
      .eq('status', 'ready_for_review')
      .order('created_at', { ascending: true })
      .limit(20);
    return { items: runs ?? [], cursor: null };
  }
}
