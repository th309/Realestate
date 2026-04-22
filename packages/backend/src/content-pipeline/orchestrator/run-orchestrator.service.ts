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
    const next = nextStateOnSuccess(
      run.status as PipelineStatus,
      run.approval_mode as ApprovalMode,
    );
    if (next) await this.transitionTo(runId, next, { enqueueNext: true });
  }

  async handleStepFailure(runId: string, reason: string): Promise<void> {
    await this.transitionTo(runId, 'failed', { reason, enqueueNext: false });
  }
}
