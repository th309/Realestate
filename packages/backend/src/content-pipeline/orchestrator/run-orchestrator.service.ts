import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { QueueService, QueueName } from './queue.service';
import { canTransition, nextStateOnSuccess } from './pipeline-state';
import { PipelineStatus, ApprovalMode } from '../types';

export interface TransitionOptions {
  reason?: string;
  enqueueNext?: boolean;
  eventPayload?: Record<string, unknown>;
}

const STATE_QUEUE_MAP: Record<PipelineStatus, QueueName | null> = {
  queued: 'orchestrator',
  fetching_data: 'orchestrator',
  scripting: 'orchestrator',
  verifying_data: 'orchestrator',
  linting_voice: 'orchestrator',
  rendering_voice: 'render-audio',
  timing_captions: 'render-captions',
  rendering_video: 'render-video',
  ready_for_review: null,
  publishing: 'orchestrator',
  published: null,
  published_partial: null,
  rejected: null,
  failed: null,
};

@Injectable()
export class RunOrchestratorService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly queue: QueueService,
  ) {}

  async transitionTo(
    runId: string,
    to: PipelineStatus,
    opts: TransitionOptions = {},
  ): Promise<void> {
    const client = this.supabase.getClient();

    const { data: run, error: fetchErr } = await client
      .from('content_runs')
      .select('status, approval_mode, format')
      .eq('id', runId)
      .single();
    if (fetchErr || !run) throw new Error(`Run ${runId} not found`);

    if (!canTransition(run.status as PipelineStatus, to)) {
      throw new Error(
        `Invalid transition from ${run.status} to ${to} for run ${runId}`,
      );
    }

    await client
      .from('content_runs')
      .update({
        status: to,
        status_reason: opts.reason ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', runId);

    await client.from('content_run_events').insert({
      run_id: runId,
      event_type: 'status_changed',
      payload: {
        from: run.status,
        to,
        reason: opts.reason,
        ...opts.eventPayload,
      },
    });

    if (opts.enqueueNext !== false) {
      const queueName = STATE_QUEUE_MAP[to];
      if (queueName) await this.queue.send(queueName, { runId, status: to });
    }
  }

  async handleStepSuccess(runId: string): Promise<void> {
    const client = this.supabase.getClient();
    const { data: run } = await client
      .from('content_runs')
      .select('status, approval_mode')
      .eq('id', runId)
      .single();
    if (!run) return;

    const effectiveMode = await this.resolveEffectiveApprovalMode(
      client,
      runId,
      run.status as PipelineStatus,
      run.approval_mode as ApprovalMode,
    );
    const next = nextStateOnSuccess(
      run.status as PipelineStatus,
      effectiveMode,
    );
    if (next) await this.transitionTo(runId, next, { enqueueNext: true });
  }

  /**
   * Gate-warned escalator: if we're about to transition out of
   * rendering_video and any gate for this run emitted `result='warned'`,
   * force approval_mode='review' so a human eyeballs the run before it
   * publishes — regardless of the format's default (auto/draft). The
   * gates themselves still pass; this only changes the post-render
   * routing decision.
   */
  private async resolveEffectiveApprovalMode(
    client: ReturnType<SupabaseService['getClient']>,
    runId: string,
    currentStatus: PipelineStatus,
    approvalMode: ApprovalMode,
  ): Promise<ApprovalMode> {
    if (currentStatus !== 'rendering_video') return approvalMode;
    if (approvalMode === 'review') return approvalMode;
    const { data: warnings } = await client
      .from('content_run_gates')
      .select('gate')
      .eq('run_id', runId)
      .eq('result', 'warned')
      .limit(1);
    return warnings && warnings.length > 0 ? 'review' : approvalMode;
  }

  async handleStepFailure(runId: string, reason: string): Promise<void> {
    await this.transitionTo(runId, 'failed', { reason, enqueueNext: false });
  }

  async retryRun(runId: string): Promise<void> {
    await this.transitionTo(runId, 'queued', {
      reason: 'manual_retry',
      enqueueNext: false,
    });
    await this.transitionTo(runId, 'fetching_data', { enqueueNext: true });
  }
}
