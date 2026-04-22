import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SupabaseService } from '../../supabase/supabase.service';
import { QueueService, QueueName } from '../orchestrator/queue.service';
import { PipelineStatus } from '../types';

/**
 * Per-step timeouts in minutes. A run in one of these statuses with no
 * content_run_events activity within the timeout is considered stuck and
 * re-enqueued on the queue responsible for advancing that step.
 */
const STEP_TIMEOUT_MIN: Partial<Record<PipelineStatus, number>> = {
  fetching_data: 10,
  scripting: 10,
  verifying_data: 5,
  linting_voice: 5,
  rendering_voice: 15,
  timing_captions: 10,
  rendering_video: 20,
  publishing: 30,
};

const STATE_TO_QUEUE: Partial<Record<PipelineStatus, QueueName>> = {
  fetching_data: 'orchestrator',
  scripting: 'orchestrator',
  verifying_data: 'orchestrator',
  linting_voice: 'orchestrator',
  rendering_voice: 'render-audio',
  timing_captions: 'render-captions',
  rendering_video: 'render-video',
  publishing: 'orchestrator',
};

/**
 * Every 5 minutes, scans content_runs for runs stuck in a non-terminal
 * status past that step's timeout and re-enqueues them on the appropriate
 * worker queue. This is the backstop for jobs lost to worker crashes,
 * deploys, or transient Postgres issues.
 */
@Injectable()
export class RecoverStuckRunsCron implements OnModuleInit {
  private readonly logger = new Logger(RecoverStuckRunsCron.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly queue: QueueService,
  ) {}

  async onModuleInit(): Promise<void> {
    setTimeout(() => {
      this.run().catch((err) =>
        this.logger.error('boot-time recovery scan failed', err),
      );
    }, 60_000);
  }

  @Cron('*/5 * * * *')
  async run(): Promise<void> {
    const client = this.supabase.getClient();
    const nonTerminal = Object.keys(STEP_TIMEOUT_MIN) as PipelineStatus[];
    const { data: runs, error: selectErr } = await client
      .from('content_runs')
      .select('id, status, updated_at')
      .in('status', nonTerminal);
    if (selectErr) {
      this.logger.error('stuck-run scan query failed', selectErr);
      return;
    }
    if (!runs || runs.length === 0) return;

    this.logger.log(`scanning ${runs.length} non-terminal runs`);

    let recovered = 0;
    for (const run of runs) {
      const { data: latestEvent } = await client
        .from('content_run_events')
        .select('created_at')
        .eq('run_id', run.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      const lastActivity = new Date(latestEvent?.created_at ?? run.updated_at);
      const ageMin = (Date.now() - lastActivity.getTime()) / 60_000;
      const timeoutMin = STEP_TIMEOUT_MIN[run.status as PipelineStatus] ?? 30;

      if (ageMin > timeoutMin) {
        const queueName = STATE_TO_QUEUE[run.status as PipelineStatus];
        if (!queueName) {
          this.logger.warn(
            `no queue mapped for status ${run.status} (run ${run.id})`,
          );
          continue;
        }
        try {
          const jobId = await this.queue.send(queueName, {
            runId: run.id,
            status: run.status,
          });
          this.logger.warn(
            `re-enqueued stuck run ${run.id} in status ${run.status} after ${ageMin.toFixed(1)} min (jobId=${jobId})`,
          );
          recovered++;
        } catch (err) {
          this.logger.error(
            `failed to re-enqueue run ${run.id} (${run.status})`,
            err,
          );
        }
      }
    }
    if (recovered > 0) this.logger.log(`recovered ${recovered} stuck runs`);
  }
}
