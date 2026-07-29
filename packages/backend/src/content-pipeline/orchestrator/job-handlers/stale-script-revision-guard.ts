/**
 * Stale-script epoch guard for the pipeline job handlers.
 *
 * WHY THIS EXISTS
 * Operators can edit a run's script at any stage where a script asset exists
 * (`RunActionsService.editScript`). Saving re-enters the pipeline at
 * `verifying_data` and bumps `content_runs.script_revision`. Nothing cancels
 * the worker that is already running against the OLD text — it keeps going and
 * then performs its normal terminal write.
 *
 * Left unguarded, that zombie worker does one of two bad things:
 *
 *   1. It calls `transitionTo` with the onward state it ASSUMED it was
 *      advancing to. Most of those edges are illegal from `verifying_data`, so
 *      `transitionTo` throws, the handler's catch calls `handleStepFailure`,
 *      and the freshly-restarted run is driven to `failed`. The operator's fix
 *      appears to have killed the run.
 *   2. It calls `handleStepSuccess`, which re-reads the CURRENT status and so
 *      never throws — it quietly walks the restarted run forward
 *      (`verifying_data` -> `linting_voice`), skipping the fact-check the edit
 *      existed to trigger, after overwriting the run's assets with output built
 *      from text the operator already replaced.
 *
 * THE PATTERN
 * Every script-dependent handler captures the revision at entry and re-checks
 * it immediately before its terminal write. When the value moved, the handler
 * logs, records a `stale_step_discarded` event, and returns — WITHOUT
 * transitioning and WITHOUT calling `handleStepFailure`. The run itself is
 * healthy; it is only this worker's result that is garbage, and failing the run
 * is the precise outcome this guard exists to prevent.
 *
 * FAIL-OPEN BY DESIGN
 * If either read fails (transient DB error, or a caller whose client cannot
 * serve the query) we cannot PROVE the step is stale, so we let it through. A
 * false "stale" verdict is far worse than a missed one: it would strand a run
 * mid-pipeline with no worker left to advance it, whereas a missed one merely
 * reproduces the pre-guard behaviour.
 *
 * KNOWN GAP
 * The capture happens when the handler STARTS, not when its job was enqueued.
 * An edit that lands while the job is still waiting in the queue is invisible
 * here — the worker wakes up and captures the already-bumped value, so the
 * before/after comparison matches. Closing that would mean stamping the
 * revision onto the queue payload in `transitionTo`. This guard covers the far
 * larger window: the edit landing while the handler is actually running (TTS
 * and Remotion alone budget 180s and 360s respectively).
 */
import { Logger } from '@nestjs/common';
import { SupabaseService } from '../../../supabase/supabase.service';

type PipelineSupabaseClient = ReturnType<SupabaseService['getClient']>;

/**
 * Read the run's current script epoch.
 *
 * @returns the revision, or null when it cannot be read. Null means "unknown",
 *          never "zero" — inventing an epoch would let the guard fire on a run
 *          whose script never changed.
 */
export async function captureScriptRevision(
  client: PipelineSupabaseClient,
  runId: string,
): Promise<number | null> {
  try {
    const { data, error } = await client
      .from('content_runs')
      .select('script_revision')
      .eq('id', runId)
      .maybeSingle();
    if (error || !data) return null;
    const revision = (data as { script_revision?: unknown }).script_revision;
    return typeof revision === 'number' ? revision : null;
  } catch {
    // Deliberately swallowed: this read is advisory. A handler must never fail
    // a run because the epoch lookup itself broke.
    return null;
  }
}

export interface StaleStepCheck {
  runId: string;
  /**
   * Pipeline step name (`rendering_voice`, `publish-tiktok`, ...). Recorded on
   * the event so an operator reading the run's timeline can tell WHICH worker
   * discarded itself, not just that one did.
   */
  step: string;
  /** Value returned by `captureScriptRevision` at handler entry. */
  capturedRevision: number | null;
}

/**
 * Re-read the epoch and compare it against the value captured at entry.
 *
 * @returns true when the script changed under this step, meaning the caller
 *          must bail out without transitioning and without failing the run.
 */
export async function isStepStaleAfterScriptEdit(
  client: PipelineSupabaseClient,
  logger: Logger,
  { runId, step, capturedRevision }: StaleStepCheck,
): Promise<boolean> {
  // Nothing to compare against — the entry read failed, so staleness is
  // unprovable and must not be invented.
  if (capturedRevision === null) return false;

  const currentRevision = await captureScriptRevision(client, runId);
  if (currentRevision === null || currentRevision === capturedRevision) {
    return false;
  }

  logger.warn(
    `[PIPE] ${step} DISCARDED run=${runId} — script edited mid-step (revision ${capturedRevision} -> ${currentRevision}); dropping this worker's result`,
  );

  // Durable breadcrumb. Without it the run's event log shows a step starting
  // and simply never finishing, which is indistinguishable from a hung worker.
  try {
    const { error } = await client.from('content_run_events').insert({
      run_id: runId,
      event_type: 'stale_step_discarded',
      payload: { capturedRevision, currentRevision, step },
    });
    if (error) throw new Error(error.message);
  } catch (e) {
    // The verdict stands even when the breadcrumb fails. Rethrowing would land
    // the caller in its catch block, which calls handleStepFailure and drives
    // the restarted run to `failed` — exactly the bug this guard prevents.
    logger.error(
      `[PIPE] ${step} could not persist stale_step_discarded run=${runId}: ${(e as Error).message}`,
    );
  }

  return true;
}
