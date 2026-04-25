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
 * Operator-driven mutations on existing runs: approve, reject, cancel,
 * retry, and edit-script-then-relint. Reads live in
 * `content-pipeline-queries.service.ts`; new-run creation lives in
 * `content-runs.service.ts`.
 */
@Injectable()
export class RunActionsService {
  private readonly logger = new Logger(RunActionsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly orchestrator: RunOrchestratorService,
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
        await this.cancelRun(runId, 'user_deleted_in_flight');
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
