import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../../supabase/supabase.service';
import { RunOrchestratorService } from '../run-orchestrator.service';
import { DataVerifierService } from '../../gates/data-verifier.service';

@Injectable()
export class VerifyDataHandler {
  constructor(
    private readonly orchestrator: RunOrchestratorService,
    private readonly gate: DataVerifierService,
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

      const { data: payloadAsset } = await client
        .from('content_assets')
        .select('metadata')
        .eq('run_id', runId)
        .eq('kind', 'mcp_payload')
        .single();
      if (!payloadAsset) throw new Error('mcp_payload asset not found');

      const script = scriptAsset.metadata.scripts[0];
      const result = await this.gate.verify(
        script.fullText,
        payloadAsset.metadata,
      );

      await client.from('content_run_gates').insert({
        run_id: runId,
        gate: 'data_verifier',
        result: result.passed ? 'passed' : 'failed',
        details: { violations: result.violations },
      });

      if (result.passed) {
        await this.orchestrator.transitionTo(runId, 'linting_voice', {
          enqueueNext: true,
        });
      } else {
        await this.orchestrator.transitionTo(runId, 'ready_for_review', {
          reason: 'gate_a_drift',
          eventPayload: { violations: result.violations },
          enqueueNext: false,
        });
      }
    } catch (err) {
      await this.orchestrator.handleStepFailure(
        runId,
        `verifying_data: ${(err as Error).message}`,
      );
    }
  }
}
