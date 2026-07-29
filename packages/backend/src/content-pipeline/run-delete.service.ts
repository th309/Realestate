import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { RunOrchestratorService } from './orchestrator/run-orchestrator.service';
import type { PipelineStatus } from './types';

const IN_FLIGHT_STATES: ReadonlySet<PipelineStatus> = new Set([
  'queued',
  'fetching_data',
  'scripting',
  'verifying_data',
  'linting_voice',
  'rendering_voice',
  'timing_captions',
  'rendering_video',
  'publishing',
] as const);

export type DeleteRunResult = {
  action: 'deleted';
  previousStatus: PipelineStatus;
  wasInFlight: boolean;
  cascade: { storageObjects: number; platformsLive: string[] };
};

/**
 * Hard deletion of a run and everything it produced. Split out of
 * `RunActionsService` (CLAUDE.md §1.3) — the delete cascade spans storage
 * objects and live platform posts and shares no state with the approve /
 * reject / edit-script group that remains there.
 */
@Injectable()
export class RunDeleteService {
  private readonly logger = new Logger(RunDeleteService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly orchestrator: RunOrchestratorService,
  ) {}

  /**
   * Unconditional hard delete. For in-flight runs (queued..publishing) we
   * best-effort transition to `cancelled` first so any active worker sees
   * the cancellation signal and exits cleanly; if that transition fails
   * (e.g. row already terminal, queue unavailable) we proceed with the
   * delete anyway. Workers that finish a step after the row is gone will
   * fail to update and log a harmless warning.
   *
   * FK ON DELETE CASCADE removes content_assets, content_run_events,
   * content_run_steps, platform_posts. Storage objects are removed
   * best-effort; partial failures are logged but don't block the response
   * (orphaned files get swept by future cron).
   *
   * Does NOT take down already-published posts on social platforms — the
   * `platform_posts.status='posted'` rows are deleted from PropertyIQ but
   * the actual TikTok/IG/FB/LinkedIn/YouTube posts remain live.
   */
  async deleteRun(runId: string): Promise<DeleteRunResult> {
    const client = this.supabase.getClient();
    const { data: run, error: runErr } = await client
      .from('content_runs')
      .select('id, status')
      .eq('id', runId)
      .maybeSingle();
    if (runErr) throw runErr;
    if (!run) throw new NotFoundException(`run ${runId} not found`);

    const status = run.status as PipelineStatus;
    const wasInFlight = IN_FLIGHT_STATES.has(status);

    if (wasInFlight) {
      try {
        await this.orchestrator.transitionTo(runId, 'cancelled', {
          reason: 'user_deleted_in_flight',
          enqueueNext: false,
        });
      } catch (e) {
        this.logger.warn(
          `[ACTION] delete-run cancel-step failed run=${runId}: ${(e as Error).message} — proceeding with hard delete`,
        );
      }
    }

    // Look up still-live platform posts before delete so we can echo back
    // what remains on social platforms — useful for the operator's audit.
    const { data: postedPosts } = await client
      .from('platform_posts')
      .select('platform')
      .eq('run_id', runId)
      .eq('status', 'posted');
    const platformsLive = (postedPosts ?? []).map((p) => p.platform as string);

    // Enumerate storage paths for the run before DB delete so we know what
    // to clean up afterward (the rows vanish on cascade).
    const { data: assets } = await client
      .from('content_assets')
      .select('storage_url')
      .eq('run_id', runId);
    const storagePaths = (assets ?? [])
      .map((a) => {
        const url = a.storage_url as string | null;
        if (!url) return null;
        const m = url.match(/^supabase:\/\/[^/]+\/(.+)$/);
        return m ? m[1] : null;
      })
      .filter((p): p is string => p !== null);

    // Audit trail before the cascade obliterates content_run_events.
    await client.from('content_run_events').insert({
      run_id: runId,
      event_type: 'run_deleted',
      payload: {
        previousStatus: status,
        platformsLive,
        storageObjectCount: storagePaths.length,
      },
    });

    // FK cascade handles all child rows.
    const { error: delErr } = await client
      .from('content_runs')
      .delete()
      .eq('id', runId);
    if (delErr) throw delErr;

    // Storage cleanup — best effort. Supabase remove() takes an array.
    let cleanedStorage = 0;
    if (storagePaths.length > 0) {
      const { data: removed, error: removeErr } = await client.storage
        .from('content-pipeline')
        .remove(storagePaths);
      if (removeErr) {
        this.logger.warn(
          `[ACTION] delete-run storage cleanup partial: ${removeErr.message}`,
        );
      } else {
        cleanedStorage = removed?.length ?? 0;
      }
    }

    this.logger.log(
      `[ACTION] delete-run run=${runId} action=deleted previousStatus=${status} wasInFlight=${wasInFlight} storage=${cleanedStorage}/${storagePaths.length} platformsLive=${platformsLive.join(',') || 'none'}`,
    );
    return {
      action: 'deleted',
      previousStatus: status,
      wasInFlight,
      cascade: { storageObjects: cleanedStorage, platformsLive },
    };
  }
}
