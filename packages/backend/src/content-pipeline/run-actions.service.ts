import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { RunOrchestratorService } from './orchestrator/run-orchestrator.service';

/**
 * Operator-driven mutations on existing runs: approve, reject, cancel,
 * retry, and edit-script-then-relint. Reads live in
 * `content-pipeline-queries.service.ts`; new-run creation lives in
 * `content-runs.service.ts`.
 */
@Injectable()
export class RunActionsService {
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
}
