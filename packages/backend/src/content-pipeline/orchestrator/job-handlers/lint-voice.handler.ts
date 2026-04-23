import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../../supabase/supabase.service';
import { RunOrchestratorService } from '../run-orchestrator.service';
import { BrandVoiceLinterService } from '../../gates/brand-voice-linter.service';

@Injectable()
export class LintVoiceHandler {
  constructor(
    private readonly orchestrator: RunOrchestratorService,
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

      if (result.passed) {
        await this.orchestrator.transitionTo(runId, 'rendering_voice', {
          enqueueNext: true,
        });
      } else {
        await this.orchestrator.transitionTo(runId, 'ready_for_review', {
          reason: 'gate_b_voice',
          eventPayload: { violations: result.violations },
          enqueueNext: false,
        });
      }
    } catch (err) {
      await this.orchestrator.handleStepFailure(
        runId,
        `linting_voice: ${(err as Error).message}`,
      );
    }
  }
}
