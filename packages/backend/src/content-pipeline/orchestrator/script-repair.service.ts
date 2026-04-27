/**
 * Script Repair Service
 *
 * When a post-script gate (brand_voice_linter today; data_verifier
 * deliberately not yet) fails, this service decides whether to retry the
 * scripting stage with the gate's violations as feedback, or to escalate
 * to ready_for_review.
 *
 * Retry budget: MAX_REPAIRS attempts after the initial script. Default 2,
 * giving 3 total LLM calls before escalating. Override via env
 * SCRIPT_REPAIR_MAX_REPAIRS at runtime.
 *
 * The script generator reads `format_options.script_repair.history` and
 * incorporates it as "previous attempt feedback" in the prompt — same
 * pattern `generateRankingScript` already uses for internal zod retries.
 */
import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { RunOrchestratorService } from './run-orchestrator.service';
import { ScriptGateViolation } from '../drivers/script-generator.interface';

export interface ScriptRepairHistoryEntry {
  gate: string;
  at: string;
  violations: ScriptGateViolation[];
}

export interface ScriptRepairState {
  repair_count: number;
  max_repairs: number;
  history: ScriptRepairHistoryEntry[];
}

export const DEFAULT_MAX_REPAIRS = parseInt(
  process.env.SCRIPT_REPAIR_MAX_REPAIRS ?? '2',
  10,
);

@Injectable()
export class ScriptRepairService {
  private readonly logger = new Logger(ScriptRepairService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly orchestrator: RunOrchestratorService,
  ) {}

  /**
   * Try to repair a failed-gate script by re-running the scripting stage
   * with the violations as feedback. Returns true if a repair was triggered
   * (caller should NOT escalate); false if the retry budget is exhausted
   * (caller MUST escalate to ready_for_review).
   */
  async attemptRepair(
    runId: string,
    gate: string,
    violations: ScriptGateViolation[],
  ): Promise<boolean> {
    const client = this.supabase.getClient();

    const { data: run } = await client
      .from('content_runs')
      .select('format_options')
      .eq('id', runId)
      .single();
    if (!run) {
      this.logger.warn(`attemptRepair: run ${runId} not found; cannot repair`);
      return false;
    }

    const formatOptions = (run.format_options ?? {}) as Record<string, unknown>;
    const existing = (formatOptions.script_repair ??
      {}) as Partial<ScriptRepairState>;
    const repairCount = existing.repair_count ?? 0;
    const maxRepairs = existing.max_repairs ?? DEFAULT_MAX_REPAIRS;

    if (repairCount >= maxRepairs) {
      this.logger.log(
        `Run ${runId}: script repair budget exhausted (${repairCount}/${maxRepairs}); escalating to ready_for_review`,
      );
      return false;
    }

    const updated: ScriptRepairState = {
      repair_count: repairCount + 1,
      max_repairs: maxRepairs,
      history: [
        ...(existing.history ?? []),
        { gate, at: new Date().toISOString(), violations },
      ],
    };

    await client
      .from('content_runs')
      .update({
        format_options: { ...formatOptions, script_repair: updated },
      })
      .eq('id', runId);

    this.logger.log(
      `Run ${runId}: attempting script repair ${updated.repair_count}/${updated.max_repairs} after ${gate} fail (${violations.length} violations)`,
    );

    await this.orchestrator.transitionTo(runId, 'scripting', {
      reason: `repair_after_${gate}`,
      eventPayload: {
        repair_count: updated.repair_count,
        max_repairs: updated.max_repairs,
        violations,
      },
      enqueueNext: true,
    });

    return true;
  }
}
