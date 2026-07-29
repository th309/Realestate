import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { RunOrchestratorService } from './orchestrator/run-orchestrator.service';
import { RunDeleteService } from './run-delete.service';
import type { DeleteRunResult } from './run-delete.service';
import type { PipelineStatus } from './types';
import { resolveNextPipelineStepAfterReview } from './next-pipeline-step-after-review';

// Re-exported so existing importers of DeleteRunResult keep their import path.
export type { DeleteRunResult };

/**
 * Stages at which a run has a script the operator can replace.
 *
 * Excluded, and why:
 *   queued / fetching_data / generating_infographic — generate-script has not
 *     run, so there is no script asset to edit.
 *   publishing — posting is irreversible; restarting mid-publish risks
 *     double-posting.
 *   published / published_partial / rejected / cancelled / infographic_ready —
 *     terminal.
 */
const SCRIPT_EDITABLE_STATES: ReadonlySet<PipelineStatus> = new Set([
  'scripting',
  'verifying_data',
  'linting_voice',
  'rendering_voice',
  'timing_captions',
  'rendering_video',
  'ready_for_review',
  'failed',
] as const);

/**
 * Operator-driven mutations on existing runs: approve, reject, cancel,
 * retry, and edit-script-then-relint. Reads live in
 * `content-pipeline-queries.service.ts`; new-run creation lives in
 * `content-runs.service.ts`; the delete cascade lives in
 * `run-delete.service.ts`.
 */
@Injectable()
export class RunActionsService {
  private readonly logger = new Logger(RunActionsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly orchestrator: RunOrchestratorService,
    private readonly runDelete: RunDeleteService,
  ) {}

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

  private nextPipelineStepAfterReview(
    runId: string,
    options?: { mode?: 'resume' | 'edit_script' },
  ): Promise<'verifying_data' | 'linting_voice'> {
    return resolveNextPipelineStepAfterReview(
      this.supabase.getClient(),
      runId,
      options,
    );
  }

  /**
   * Operator explicitly continues the pipeline from review without mutating
   * the script (re-run verify when Gate A last failed, else voice lint).
   */
  async resumePipelineFromReview(
    runId: string,
  ): Promise<{ nextStatus: PipelineStatus }> {
    const client = this.supabase.getClient();
    const { data: run, error } = await client
      .from('content_runs')
      .select('status')
      .eq('id', runId)
      .maybeSingle();
    if (error || !run) throw new NotFoundException(`run ${runId} not found`);
    if (run.status !== 'ready_for_review') {
      throw new BadRequestException(
        `resume_pipeline_invalid_state: status is ${run.status}, expected ready_for_review`,
      );
    }
    const next = await this.nextPipelineStepAfterReview(runId, {
      mode: 'resume',
    });
    await this.orchestrator.transitionTo(runId, next, {
      reason: 'operator_resume',
      enqueueNext: true,
    });
    this.logger.log(`[ACTION] resume-pipeline run=${runId} next=${next}`);
    return { nextStatus: next };
  }

  /**
   * Replace a run's script and re-enter the pipeline.
   *
   * Editable at every stage where a script asset exists. Saving from a
   * mid-flight state restarts the run at `verifying_data` so the edited claims
   * are fact-checked again; the worker still running against the old text
   * discards itself on the `script_revision` check rather than clobbering the
   * restart.
   *
   * From `ready_for_review` the historic resolver still decides the target
   * (`verifying_data` when the data verifier last failed, else `linting_voice`)
   * — the review queue depends on that behaviour and on the `{ nextStatus }`
   * response shape.
   *
   * Order matters: the status guard runs BEFORE the write. Previously the asset
   * was overwritten first and `transitionTo` threw afterwards on an illegal
   * transition, which persisted the edit, returned a 500, and left the run in
   * its original state.
   */
  async editScript(
    runId: string,
    variantId: 'A' | 'B',
    newFullText: string,
  ): Promise<{ nextStatus: PipelineStatus }> {
    const client = this.supabase.getClient();

    const { data: run, error: runError } = await client
      .from('content_runs')
      .select('status')
      .eq('id', runId)
      .maybeSingle();
    if (runError || !run) throw new NotFoundException(`run ${runId} not found`);

    const status = run.status as PipelineStatus;
    if (!SCRIPT_EDITABLE_STATES.has(status)) {
      throw new BadRequestException(
        `edit_script_invalid_state: status is ${status}, which has no editable script`,
      );
    }

    // `ready_for_review` keeps the historic gate-aware resolution; every other
    // stage restarts at fact-check because the script changed under it.
    const nextStatus: PipelineStatus =
      status === 'ready_for_review'
        ? await this.nextPipelineStepAfterReview(runId, { mode: 'edit_script' })
        : 'verifying_data';

    const { data: scriptAsset, error } = await client
      .from('content_assets')
      .select('metadata')
      .eq('run_id', runId)
      .eq('kind', 'script')
      .single();
    if (error || !scriptAsset)
      throw new NotFoundException(`script asset not found for run ${runId}`);

    const existingMetadata = (scriptAsset.metadata ?? {}) as Record<
      string,
      unknown
    >;
    const scripts = (existingMetadata.scripts ?? []) as Array<{
      variantId: string;
      fullText: string;
      [key: string]: unknown;
    }>;
    if (!scripts.some((s) => s.variantId === variantId)) {
      throw new BadRequestException(
        `edit_script_unknown_variant: run ${runId} has no variant ${variantId}`,
      );
    }
    const updated = scripts.map((s) =>
      s.variantId === variantId ? { ...s, fullText: newFullText } : s,
    );

    // Re-read the status immediately before writing. `transitionTo` validates
    // again at the end, but by then the asset is already committed — if a worker
    // advanced the run between the guard above and here, we would persist an
    // edit and then throw. Checking at the last moment shrinks that window to
    // the writes themselves.
    const { data: current } = await client
      .from('content_runs')
      .select('status')
      .eq('id', runId)
      .maybeSingle();
    if (current && current.status !== status) {
      throw new BadRequestException(
        `edit_script_status_moved: run advanced from ${status} to ${current.status} while editing — reload and try again`,
      );
    }

    await client
      .from('content_assets')
      .update({ metadata: { ...existingMetadata, scripts: updated } })
      .eq('run_id', runId)
      .eq('kind', 'script');

    // Keep `hook_variants` in step — generate-script writes the same array there
    // and this method used to leave that copy stale after every edit.
    await client
      .from('content_runs')
      .update({ hook_variants: updated })
      .eq('id', runId);

    // Bump the epoch so any in-flight handler discards its result. Done in the
    // database (see migration 20260729143000): a read-modify-write here would
    // let two concurrent edits collapse into a single revision, which is exactly
    // the case the guard exists to catch.
    const { data: revision, error: revisionError } = await client.rpc(
      'increment_script_revision',
      { p_run_id: runId },
    );
    if (revisionError) {
      throw new Error(
        `edit_script_revision_bump_failed: ${revisionError.message}`,
      );
    }

    await this.orchestrator.transitionTo(runId, nextStatus, {
      reason: 'operator_edit',
      enqueueNext: true,
    });
    this.logger.log(
      `[ACTION] edit-script run=${runId} from=${status} next=${nextStatus} rev=${revision}`,
    );
    return { nextStatus };
  }

  async retryRun(runId: string): Promise<void> {
    await this.orchestrator.retryRun(runId);
  }

  /** Delegates to RunDeleteService — see that file for the cascade semantics. */
  deleteRun(runId: string): Promise<DeleteRunResult> {
    return this.runDelete.deleteRun(runId);
  }
}
