import { ConflictException, Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateRunDto, RankingRunParams } from './dto/create-run.dto';
import { RunOrchestratorService } from './orchestrator/run-orchestrator.service';
import { QueueService } from './orchestrator/queue.service';
import { ContentDataService } from './data/content-data.service';
import { LeadMagnetKind } from './drivers/lead-magnet-renderer.interface';
import { RankingResolverService } from './ranking/ranking-resolver.service';
import { CostCapService } from './auto-ideation/cost-cap.service';

/**
 * Operations that *create* content-pipeline work: spawn a new run from
 * the wizard, resolve a market query for the wizard's autocomplete, and
 * the admin-only test-magnet trigger.
 *
 * Read queries live in `content-pipeline-queries.service.ts` and
 * mutations on existing runs live in `run-actions.service.ts`.
 */
@Injectable()
export class ContentRunsService {
  private readonly FORMAT_COST_ESTIMATES: Record<string, number> = {
    grade_reveal: 0.05,
    top_10_ranking: 0.08,
    bottom_10_ranking: 0.08,
    score_mover: 0.05,
    head_to_head: 0.08,
    farm_area_spotlight: 0.09,
    brokerage_market_share: 0.09,
    recruitment_angle: 0.1,
    long_form_deep_dive: 2.2,
  };

  constructor(
    private readonly supabase: SupabaseService,
    private readonly orchestrator: RunOrchestratorService,
    private readonly queueService: QueueService,
    private readonly contentData: ContentDataService,
    private readonly rankingResolver: RankingResolverService,
    private readonly costCap: CostCapService,
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

    if (
      (dto.format === 'top_10_ranking' || dto.format === 'bottom_10_ranking') &&
      dto.rankingParams
    ) {
      await this.checkRankingDrift(dto.rankingParams);
    }

    const { data: template } = await client
      .from('format_templates')
      .select('*')
      .eq('format', dto.format)
      .single();
    if (!template) throw new Error(`format ${dto.format} not configured`);
    if (!template.enabled) throw new Error(`format ${dto.format} is disabled`);

    // Auto-ideation caps are enforced at enqueue time only.
    if (dto.triggeredBy === 'auto_ideation') {
      const estimate = this.estimateCostUsd(dto.format);
      const costCheck = await this.costCap.canEnqueue(estimate);
      if (!costCheck.allowed) {
        await client.from('auto_ideation_capped_events').insert({
          rule_id: dto.autoIdeationRuleId ?? null,
          format: dto.format,
          reason: 'daily_cost_cap',
          metadata: {
            rule_name: dto.autoIdeationRuleName ?? null,
            remainingUsd: costCheck.remainingUsd,
            estimateUsd: estimate,
            usdSpent: costCheck.usdSpent,
            usdCap: costCheck.usdCap,
          },
        });
        return { id: '', idempotencyKey: dto.idempotencyKey, status: 'capped' };
      }

      const formatCheck = await this.costCap.canEnqueueFormat(dto.format);
      if (!formatCheck.allowed) {
        await client.from('auto_ideation_capped_events').insert({
          rule_id: dto.autoIdeationRuleId ?? null,
          format: dto.format,
          reason: 'format_daily_cap',
          metadata: {
            rule_name: dto.autoIdeationRuleName ?? null,
            count: formatCheck.count,
            cap: formatCheck.cap,
          },
        });
        return { id: '', idempotencyKey: dto.idempotencyKey, status: 'capped' };
      }
      await this.costCap.incrementFormatCount(dto.format);
    }

    // Persist the operator-approved ranking snapshot under format_options.ranking
    // so fetch-data has the markets to render against (skipping the
    // single-market resolveMarket lookup that fits other formats).
    const formatOptions: Record<string, unknown> = {
      ...(dto.formatOptions ?? {}),
      ...(dto.rankingParams ? { ranking: dto.rankingParams } : {}),
    };

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
        batch_id: dto.batchId ?? null,
        format_options: formatOptions,
        status: 'queued',
        triggered_by: dto.triggeredBy ?? 'manual',
      })
      .select('id, status')
      .single();
    if (error) throw error;

    if (dto.triggeredBy === 'auto_ideation') {
      await client.from('content_run_events').insert({
        run_id: inserted.id,
        event_type: 'auto_ideation_enqueued',
        payload: {
          rule_id: dto.autoIdeationRuleId ?? null,
          rule_name: dto.autoIdeationRuleName ?? null,
        },
      });
    }

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

  private estimateCostUsd(format: string): number {
    return this.FORMAT_COST_ESTIMATES[format] ?? 0.1;
  }

  private async checkRankingDrift(params: RankingRunParams): Promise<void> {
    const fresh = await this.rankingResolver.resolve({
      format: params.format,
      metric_id: params.metric.id,
      geo_level: params.geo_level,
      scope_type: params.scope.type,
      scope_id: params.scope.id,
    });

    const submittedKey = (params.resolved_markets ?? [])
      .map((m) => `${m.rank}:${m.region_id}`)
      .join('|');
    const freshKey = fresh.rankings
      .map((m) => `${m.rank}:${m.region_id}`)
      .join('|');

    if (submittedKey !== freshKey) {
      throw new ConflictException({
        error: 'data_drift',
        message:
          'Data shifted while you were reviewing — please re-run preview.',
      });
    }
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
}
