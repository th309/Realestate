import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../../supabase/supabase.service';
import { RunOrchestratorService } from '../run-orchestrator.service';
import { ScriptRepairService } from '../script-repair.service';
import { BrandVoiceLinterService } from '../../gates/brand-voice-linter.service';
import { ScriptGateViolation } from '../../drivers/script-generator.interface';

interface LinterViolation {
  claim?: { quote?: string; subject?: string };
}

function toGateViolations(
  violations: LinterViolation[] | undefined,
): ScriptGateViolation[] {
  return (violations ?? []).map((v) => ({
    quote: v.claim?.quote ?? '',
    issue: v.claim?.subject ?? '',
  }));
}

@Injectable()
export class LintVoiceHandler {
  constructor(
    private readonly orchestrator: RunOrchestratorService,
    private readonly scriptRepair: ScriptRepairService,
    private readonly gate: BrandVoiceLinterService,
    private readonly supabase: SupabaseService,
  ) {}

  async handle(runId: string): Promise<void> {
    try {
      const client = this.supabase.getClient();
      const { data: scriptAsset } = await client
        .from('content_assets')
        .select('metadata')
        .eq('run_id', runId)
        .eq('kind', 'script')
        .single();
      if (!scriptAsset) throw new Error('script asset not found');

      const script = scriptAsset.metadata.scripts[0];
      const result = await this.gate.lint(script.fullText);

      const gateOutcome = result.passed
        ? result.warned
          ? 'warned'
          : 'passed'
        : 'failed';
      await client.from('content_run_gates').insert({
        run_id: runId,
        gate: 'brand_voice_linter',
        result: gateOutcome,
        details: { violations: result.violations },
        llm_judge_response: result.llm_judge_response ?? null,
      });

      await client.from('content_run_events').insert({
        run_id: runId,
        event_type: 'lint_voice_done',
        payload: {
          outcome: gateOutcome,
          passed: result.passed,
          warned: result.warned,
          violations_count: (result.violations ?? []).length,
          violations_preview: (result.violations ?? []).slice(0, 5),
          script_chars: script.fullText.length,
        },
      });

      if (result.passed) {
        await this.orchestrator.transitionTo(runId, 'rendering_voice', {
          enqueueNext: true,
        });
        return;
      }

      // Gate failed — try a repair-with-feedback pass before escalating.
      const gateViolations = toGateViolations(
        result.violations as LinterViolation[],
      );
      const repairing = await this.scriptRepair.attemptRepair(
        runId,
        'brand_voice_linter',
        gateViolations,
      );
      if (repairing) return;

      // Repair budget exhausted — escalate to manual review with violations attached.
      await this.orchestrator.transitionTo(runId, 'ready_for_review', {
        reason: 'gate_b_voice_exhausted',
        eventPayload: { violations: result.violations },
        enqueueNext: false,
      });
    } catch (err) {
      await this.orchestrator.handleStepFailure(
        runId,
        `linting_voice: ${(err as Error).message}`,
      );
    }
  }
}
